# dl-tiles

[![Dependency Status](https://david-dm.org/julien-f/dl-tiles/status.svg?theme=shields.io)](https://david-dm.org/julien-f/dl-tiles)
[![devDependency Status](https://david-dm.org/julien-f/dl-tiles/dev-status.svg?theme=shields.io)](https://david-dm.org/julien-f/dl-tiles#info=devDependencies)
> Downloads tiles from OSM for a location and saves them in an MBTiles store.


## Install

Download [manually](https://github.com/julien-f/dl-tiles/releases) or with package-manager.

#### [npm](https://npmjs.org/package/dl-tiles)

```
npm install --global dl-tiles
```

## Example

```
> dl-tiles -h
Usage: dl-tiles [<option>...] <mbTiles> <location>

Options:
  -h, --help     display this help message
  -v, --version  display the version number
  -z, --zoom     zoom level                  [default: 12]
> dl-tiles ./tiles.mbtiles 'Paris, France'
Downloading 8 tiles...
2/8 downloaded: 2074×1408
1/8 downloaded: 2073×1408
4/8 downloaded: 2076×1408
3/8 downloaded: 2075×1408
5/8 downloaded: 2073×1409
6/8 downloaded: 2074×1409
8/8 downloaded: 2076×1409
7/8 downloaded: 2075×1409
```
