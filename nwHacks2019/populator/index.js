const wikipedia = require('node-wikipedia')
const request = require('request-promise-native')
const stripe = require('stripe')('sk_test_0iNINdJGVhXbS0CboDP4ElTJ')

//stripe.products.list({limit: 10}).then(d => console.log(d))

function updateStripeProducts() {
    var ids = ['increment', 'shirt', 'pins']
    for(i in ids) {
        var id = ids[i]
        stripe.products.update(id, {
            active: false
        }).then(d => console.log(d))
        console.log(id)
    }
}

function searchWikipedia(query) {
    return new Promise((resolve, reject) => {
        wikipedia.page.data(query.replace(' ', '').toLowerCase(), { content: true }, function(data) {
            return resolve(data)
        })
    })
}

function fetchWikipediaImage(query) {
    return searchWikipedia(query)
        .then(data => {
            if(data && data.title) {
                return request({
                    uri: 'https://en.wikipedia.org/w/api.php?action=query&prop=pageimages&format=json&piprop=original&titles=Quarter_Pounder',
                    qs: {
                        action: 'query',
                        prop: 'pageimages',
                        format: 'json',
                        piprop: 'original',
                        titles: data.title
                    },
                    method: 'GET',
                    json: true
                }).then(json => {
                    return Object.values(json.query.pages)[0].original.source
                })
            } else {
                return null
            }
        })
}

//updateStripeProducts()

fetchWikipediaImage('quarterpounder').then(d => console.log(d))
