#!/usr/bin/env node
"use strict";

const fs = require("fs");
const {promisify} = require("util");
const {join} = require("path");

const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

const defaults = {
  encoding: "utf8",
  strict: false,
};

// uv_fs_scandir / withFileTypes is supported in Node.js 10.10 or greater
const [_match, major, minor] = (/([0-9]+)\.([0-9]+)\./.exec(process.versions.node) || []);
const scandir = (Number(major) > 10) || (Number(major) === 10 && Number(minor) >= 10);

const rrdir = module.exports = async (dir, opts) => {
  opts = Object.assign({}, defaults, opts);

  if (!dir || !typeof dir === "string") {
    throw new Error(`Expected a string, got '${dir}'`);
  }

  let results = [];

  let entries;
  try {
    entries = await readdir(dir, {encoding: opts.encoding, withFileTypes: scandir});
  } catch (err) {
    if (opts.strict) {
      throw err;
    }
  }

  if (!entries.length) {
    return entries;
  }

  for (const entry of entries) {
    const name = scandir ? entry.name : entry;
    const path = join(dir, name);

    let stats;
    if (scandir) {
      stats = entry;
    } else {
      try {
        stats = await stat(path);
      } catch (err) {
        if (opts.strict) {
          throw err;
        }
      }
    }

    if (stats) {
      const directory = stats.isDirectory();
      const symlink = stats.isSymbolicLink();
      results.push({path, directory, symlink});

      if (directory) {
        results = results.concat(await rrdir(path, opts));
      }
    }
  }

  return results;
};

module.exports.sync = (dir, opts) => {
  opts = Object.assign({}, defaults, opts);

  let results = [];

  let entries;
  try {
    entries = fs.readdirSync(dir, {encoding: opts.encoding, withFileTypes: scandir});
  } catch (err) {
    if (opts.strict) {
      throw err;
    }
  }

  if (!entries.length) {
    return entries;
  }

  for (const entry of entries) {
    const name = scandir ? entry.name : entry;
    const path = join(dir, name);

    let stats;
    if (scandir) {
      stats = entry;
    } else {
      try {
        stats = fs.statSync(path);
      } catch (err) {
        if (opts.strict) {
          throw err;
        }
      }
    }

    if (stats) {
      const directory = stats.isDirectory();
      const symlink = stats.isSymbolicLink();
      results.push({path, directory, symlink});

      if (directory) {
        results = results.concat(rrdir.sync(path, opts));
      }
    }
  }

  return results;
};