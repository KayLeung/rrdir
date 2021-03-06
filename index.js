"use strict";

const {readdir, stat, lstat} = require("fs").promises;
const {readdirSync, statSync, lstatSync} = require("fs");
const {sep} = require("path");
const picomatch = require("picomatch");

const sepBuffer = Buffer.from(sep);

const defaults = {
  strict: false,
  stats: false,
  followSymlinks: false,
  exclude: undefined,
  include: undefined,
  match: {
    dot: true,
  },
};

function makePath(entry, dir, encoding) {
  if (encoding === "buffer") {
    return dir === "." ? entry.name : Buffer.from([...dir, ...sepBuffer, ...entry.name]);
  } else {
    return dir === "." ? entry.name : `${dir}${sep}${entry.name}`;
  }
}

function build(dirent, path, stats, opts) {
  return {
    path,
    directory: (stats || dirent).isDirectory(),
    symlink: (stats || dirent).isSymbolicLink(),
    ...(opts.stats ? {stats} : {}),
  };
}

function makeMatchers({include, exclude, match}) {
  return {
    includeMatcher: include ? picomatch(include, match) : null,
    excludeMatcher: exclude ? picomatch(exclude, match) : null,
  };
}

const rrdir = module.exports = async function* (dir, opts = {}, {includeMatcher, excludeMatcher, encoding} = {}) {
  if (includeMatcher === undefined) {
    opts = Object.assign({}, defaults, opts);
    ({includeMatcher, excludeMatcher} = makeMatchers(opts));
    if (/[/\\]$/.test(dir)) dir = dir.substring(0, dir.length - 1);
    encoding = Buffer.isBuffer(dir) ? "buffer" : undefined;
  }

  let dirents = [];

  try {
    dirents = await readdir(dir, {encoding, withFileTypes: true});
  } catch (err) {
    if (opts.strict) {
      throw err;
    } else {
      yield {path: dir, err};
    }
  }
  if (!dirents.length) return;

  for (const dirent of dirents) {
    const path = makePath(dirent, dir, encoding);
    if (excludeMatcher && excludeMatcher(encoding === "buffer" ? String(path) : path)) continue;

    let stats;
    if (opts.stats) {
      try {
        stats = await (opts.followSymlinks ? stat : lstat)(path);
      } catch (err) {
        if (opts.strict) throw err;
        yield {path, err};
      }
    }

    let recurse = false;
    if (opts.followSymlinks && dirent.isSymbolicLink()) {
      if (!stats) try { stats = await stat(path); } catch {}
      if (stats && stats.isDirectory()) recurse = true;
    } else if (dirent.isDirectory()) {
      recurse = true;
    }

    if (!includeMatcher || includeMatcher(encoding === "buffer" ? String(path) : path)) yield build(dirent, path, stats, opts);
    if (recurse) yield* await rrdir(path, opts, {includeMatcher, excludeMatcher, encoding});
  }
};

module.exports.async = async (dir, opts = {}, {includeMatcher, excludeMatcher, encoding} = {}) => {
  if (includeMatcher === undefined) {
    opts = Object.assign({}, defaults, opts);
    ({includeMatcher, excludeMatcher} = makeMatchers(opts));
    if (/[/\\]$/.test(dir)) dir = dir.substring(0, dir.length - 1);
    encoding = Buffer.isBuffer(dir) ? "buffer" : undefined;
  }

  const results = [];
  let dirents = [];

  try {
    dirents = await readdir(dir, {encoding, withFileTypes: true});
  } catch (err) {
    if (opts.strict) {
      throw err;
    } else {
      results.push({path: dir, err});
    }
  }
  if (!dirents.length) return results;

  await Promise.all(dirents.map(async dirent => {
    const path = makePath(dirent, dir, encoding);
    if (excludeMatcher && excludeMatcher(encoding === "buffer" ? String(path) : path)) return;

    let stats;
    if (opts.stats) {
      try {
        stats = await (opts.followSymlinks ? stat : lstat)(path);
      } catch (err) {
        if (opts.strict) throw err;
        results.push({path, err});
      }
    }

    let recurse = false;
    if (opts.followSymlinks && dirent.isSymbolicLink()) {
      if (!stats) try { stats = await stat(path); } catch {}
      if (stats && stats.isDirectory()) recurse = true;
    } else if (dirent.isDirectory()) {
      recurse = true;
    }

    if (!includeMatcher || includeMatcher(encoding === "buffer" ? String(path) : path)) results.push(build(dirent, path, stats, opts));
    if (recurse) results.push(...await module.exports.async(path, opts, {includeMatcher, excludeMatcher, encoding}));
  }));

  return results;
};

module.exports.sync = (dir, opts = {}, {includeMatcher, excludeMatcher, encoding} = {}) => {
  if (includeMatcher === undefined) {
    opts = Object.assign({}, defaults, opts);
    ({includeMatcher, excludeMatcher} = makeMatchers(opts));
    if (/[/\\]$/.test(dir)) dir = dir.substring(0, dir.length - 1);
    encoding = Buffer.isBuffer(dir) ? "buffer" : undefined;
  }

  const results = [];
  let dirents = [];

  try {
    dirents = readdirSync(dir, {encoding, withFileTypes: true});
  } catch (err) {
    if (opts.strict) {
      throw err;
    } else {
      results.push({path: dir, err});
    }
  }
  if (!dirents.length) return results;

  for (const dirent of dirents) {
    const path = makePath(dirent, dir, encoding);
    if (excludeMatcher && excludeMatcher(encoding === "buffer" ? String(path) : path)) continue;

    let stats;
    if (opts.stats) {
      try {
        stats = (opts.followSymlinks ? statSync : lstatSync)(path);
      } catch (err) {
        if (opts.strict) throw err;
        results.push({path, err});
      }
    }

    let recurse = false;
    if (opts.followSymlinks && dirent.isSymbolicLink()) {
      if (!stats) try { stats = statSync(path); } catch {}
      if (stats && stats.isDirectory()) recurse = true;
    } else if (dirent.isDirectory()) {
      recurse = true;
    }

    if (!includeMatcher || includeMatcher(encoding === "buffer" ? String(path) : path)) results.push(build(dirent, path, stats, opts));
    if (recurse) results.push(...module.exports.sync(path, opts, {includeMatcher, excludeMatcher, encoding}));
  }

  return results;
};
