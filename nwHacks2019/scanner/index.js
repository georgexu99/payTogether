module.exports = async (url = 'https://c1.staticflickr.com/3/2775/4074957339_abea7ce5af_b.jpg') => {
  return await api(url)
};

const fs = require('fs')
const request2 = require('request')
const request = require('request-promise-native')
const { createCanvas, loadImage } = require('canvas')

function fetchOCR(id, url) {
    // CACHED - remove when you want to call Azure API
    //return require('./data/' + id + '.json')
    return request({
        uri: 'https://canadacentral.api.cognitive.microsoft.com/vision/v2.0/ocr',
        qs: {
            language: 'unk',
            detectOrientation: true
        },
        headers: {
            'Content-Type': 'application/json',
            'Ocp-Apim-Subscription-Key': 'd5ab4b81646c4597b5a65a83e47cced7'
        },
        body: {
            url: url
        },
        method: 'POST',
        json: true
    }).then(ocr => {
        //fs.writeFileSync('./data/' + id + '.json', JSON.stringify(ocr))
        return ocr
    })
}

function drawOCR(id, url, ocr) {
    loadImage(url).then(img => {
        var canvas = createCanvas(img.width, img.height)
        var ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, img.width, img.height)
        ctx.beginPath()
        ctx.rect(
            ocr.size.bdry.min.x,
            ocr.size.bdry.min.y,
            ocr.size.bdry.max.x - ocr.size.bdry.min.x + 10,
            ocr.size.bdry.max.y - ocr.size.bdry.min.y + 10
        )
        //ctx.lineWidth = 20
        ctx.strokeStyle = 'red'
        ctx.stroke()
        ctx.closePath()
        for(i in ocr.words) {
            var word = ocr.words[i]
            ctx.beginPath()
            ctx.rect(word.org.x, word.org.y, word.size.x, word.size.y)
            if(word.label.type == 'price') {
                ctx.strokeStyle = 'blue'
                //ctx.lineWidth = 15
            } else if(word.label.type == 'total') {
                ctx.strokeStyle = 'green'
                //ctx.lineWidth = 20
            } else {
                ctx.strokeStyle = 'yellow'
                //ctx.lineWidth = 10
            }
            ctx.stroke()
            ctx.closePath()
        }
        canvas.createPNGStream().pipe(fs.createWriteStream('./images/' + id + '.png'))
    })
}

function classifyWord(ctx, word, bdry) {
    var text = word.text.trim()
    var result = {type: null, value: text}
    // Determine relative location of the word to the image
    var quartile_x = (word.min.x - bdry.min.x) / (bdry.max.x - bdry.min.x)
    var quartile_y = (word.min.y - bdry.min.y) / (bdry.max.y - bdry.min.y)
    if(quartile_x > 0.5
        && text.includes('.')
        && text.match(/([0-9])/)) {
        try {
            // Convert common OCR mistakes
            var price = parseFloat(text.toLowerCase()
                .replace('$', '')
                .replace(' ', '')
                .replace('o', 0)
                .replace(',', '.')
            )
            // Ignore small values as usually flawed OCR reading
            if(!isNaN(price) && price >= 0.99) {
                result = {
                    type: 'price',
                    value: price,
                    quartile: {x: quartile_x, y: quartile_y}
                }
                ctx.prices.push(result)
                ctx.total += price
                return result
            }
        } catch(err) {}
    }
    return result
}

function reclassifyWords(ctx) {
    ctx.total /= 2 // De-duplicate price from sub-total and tax
    var j = -1
    var total = -1
    for(i in ctx.prices) {
        var result = ctx.prices[i]
        var price = result.value
        if(result.quartile.y >= 0.65 && price >= total) {
            total = price
            j = i
        }
    }
    j = parseInt(j) // Weird string behaviour here, bypass bug
    if(j >= 0) {
        ctx.prices[j].type = 'total'
        ctx.total = ctx.prices[j].value
        // After total is found, anything after is flawed
        for(i = j + 1; i < ctx.prices.length; i++) {
            ctx.prices[i].type = null
        }
        ctx.prices = ctx.prices.slice(0, j + 1)
        // Sometimes a duplicate entry is before the total
        if(j - 1 >= 0) {
            var previous = ctx.prices[j - 1]
            if(previous.value == total) {
                previous.type = null
                ctx.prices[j - 1] = null
                ctx.prices = ctx.prices.filter(Boolean)
            }
        }
        // Backtrack and ensure nothing flawed at the start
        var backtrack = Array.from(ctx.prices).reverse()
        var remaining = total
        for(i in backtrack) {
            i = parseInt(i)
            if(i == 0) continue // Must skip the total value
            remaining = remaining - backtrack[i].value
            // Since total has been depleted these are likely
            // values in the header of the receipt
            if(remaining < -1) {
                for(k = 0; k < ctx.prices.length - i; k++) {
                   ctx.prices[k].type = null
                }
                ctx.prices = ctx.prices.slice(ctx.prices.length - i)
                break
            }
        }
    }
}

function parseOCR(ocr) {
    var words = []
    var bdry = {
        min: {x: 9999, y: 9999},
        max: {x: 0, y: 0}
    }
    for(i in ocr.regions) {
        var region = ocr.regions[i]
        for(j in region.lines) {
            var line = region.lines[j]
            for(k in line.words) {
                var word = line.words[k]
                var coords = word.boundingBox.split(',').map(i => parseInt(i))
                var min = {x: coords[0], y: coords[1]}
                var max = {x: coords[0] + coords[2], y: coords[1] + coords[3]}
                if(min.x < bdry.min.x) bdry.min.x = min.x
                if(min.y < bdry.min.y) bdry.min.y = min.y
                if(max.x > bdry.max.x) bdry.max.x = max.x
                if(max.y > bdry.max.y) bdry.max.y = max.y
                var size = {x: max.x - min.x, y: max.y - min.y}
                words.push({text: word.text, min: min, max: max, size: size})
            }
        }
    }
    var ctx = {
        prices: [],
        total: 0
    }
    words.map(word => word.label = classifyWord(ctx, word, bdry))
    reclassifyWords(ctx)
    var diff_x = words.map(word => word.size.x)
    var diff_y = words.map(word => word.size.y)
    return {
        words: words,
        size: {
            avg: {
                x: Math.floor(diff_x.reduce((a, b) => a + b) / diff_x.length),
                y: Math.floor(diff_y.reduce((a, b) => a + b) / diff_y.length)
            },
            bdry: bdry
        },
        total: ctx.total
    }
}

function snapToGrid(ocr) {
    var grid = ocr.size.avg.y
    var rows = new Set()
    for(i in ocr.words) {
        var word = ocr.words[i]
        var adjust = Math.round(word.max.y / grid) * grid
        rows.add(adjust)
        word.org = {x: word.min.x, y: word.min.y}
        word.min.y = word.min.y + (word.max.y - adjust)
        word.max.y = adjust
    }
    var ordinal = 0
    rows = new Map(Array.from(rows).sort((a, b) => a - b).map(row => [row, ordinal++]))
    ocr.rows = new Array(rows.size).fill(new Array())
    for(i in ocr.rows) {
        ocr.rows[i] = new Array()
    }
    ocr.price_rows = new Set()
    for(i in ocr.words) {
        var word = ocr.words[i]
        var row = rows.get(word.max.y)
        word.row = row
        ocr.rows[row].push(word)
        if(word.label.type == 'price') {
            ocr.price_rows.add(row)
        }
    }
    ocr.price_rows = Array.from(ocr.price_rows)
    return ocr
}

function parseReceipt(ocr) {
    var receipt = {total: ocr.total, items: []}
    for(i in ocr.price_rows) {
        // Item names only work on lists with 3+ prices
        if(ocr.price_rows.length < 3) break
        var row = ocr.rows[ocr.price_rows[i]]
        var price = 0
        var item = ''
        for(j in row) {
            if(j == 0) continue
            var word = row[j]
            if(j >= row.length - 1) {
                price = word.label.value
            } else {
                item += word.text
            }    
        }
        receipt.items.push({name: item, price: price})
    }
    return receipt
}

async function api(url) {
    return fetchOCR(null, url)
        .then(ocr => {
            return parseReceipt(snapToGrid(parseOCR(ocr)))
        })
}

