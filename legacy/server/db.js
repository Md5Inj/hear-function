/* Документное хранилище с двумя бэкендами:
   - FileStore: один JSON-файл data/db.json (локальная разработка, без зависимостей)
   - MongoStore: MongoDB (Atlas и т.п.), включается переменной MONGODB_URI; нужен пакет mongodb
   Интерфейс: get(col, id), put(col, doc) (doc.id обязателен), update(col, id, patch), del(col, id), find(col, filterFn|object), all(col) */
const fs = require('fs');
const path = require('path');

class FileStore {
  constructor(file) {
    this.file = file; this.data = {}; this.timer = null;
    try { this.data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { this.data = {}; }
  }
  col(name) { return this.data[name] || (this.data[name] = {}); }
  flush() { clearTimeout(this.timer); this.timer = setTimeout(() => { fs.mkdirSync(path.dirname(this.file), { recursive: true }); fs.writeFileSync(this.file, JSON.stringify(this.data)); }, 150); }
  async get(c, id) { const d = this.col(c)[id]; return d ? JSON.parse(JSON.stringify(d)) : null; }
  async put(c, doc) { this.col(c)[doc.id] = JSON.parse(JSON.stringify(doc)); this.flush(); return doc; }
  async update(c, id, patch) { const d = this.col(c)[id] || { id }; Object.assign(d, patch); this.col(c)[id] = d; this.flush(); return d; }
  async del(c, id) { delete this.col(c)[id]; this.flush(); }
  async find(c, f) { const fn = typeof f === 'function' ? f : d => Object.entries(f).every(([k, v]) => d[k] === v); return Object.values(this.col(c)).filter(fn).map(d => JSON.parse(JSON.stringify(d))); }
  async all(c) { return this.find(c, () => true); }
  async count(c, f) { return (await this.find(c, f)).length; }
}

class MongoStore {
  constructor(uri, dbName) { this.uri = uri; this.dbName = dbName || 'eartrainer'; this.client = null; }
  async db() {
    if (!this.client) {
      const { MongoClient } = require('mongodb');
      this.client = new MongoClient(this.uri); await this.client.connect();
    }
    return this.client.db(this.dbName);
  }
  async get(c, id) { const d = await (await this.db()).collection(c).findOne({ id }); if (d) delete d._id; return d; }
  async put(c, doc) { await (await this.db()).collection(c).replaceOne({ id: doc.id }, doc, { upsert: true }); return doc; }
  async update(c, id, patch) { await (await this.db()).collection(c).updateOne({ id }, { $set: patch }, { upsert: true }); return this.get(c, id); }
  async del(c, id) { await (await this.db()).collection(c).deleteOne({ id }); }
  async find(c, f) {
    const coll = (await this.db()).collection(c);
    if (typeof f === 'function') return (await coll.find({}).toArray()).map(d => { delete d._id; return d; }).filter(f);
    return (await coll.find(f).toArray()).map(d => { delete d._id; return d; });
  }
  async all(c) { return this.find(c, {}); }
  async count(c, f) { return (await this.db()).collection(c).countDocuments(typeof f === 'function' ? {} : f); }
}

function createStore() {
  if (process.env.MONGODB_URI) return new MongoStore(process.env.MONGODB_URI, process.env.MONGODB_DB);
  return new FileStore(process.env.DB_FILE || path.join(__dirname, '..', 'data', 'db.json'));
}
module.exports = { createStore, FileStore, MongoStore };
