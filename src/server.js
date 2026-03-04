const Koa = require('koa')
const bodyParser = require('koa-bodyparser')
const cors = require('kcors')
const namesRouter = require('./routes/names')

function createApp () {
  const app = new Koa()

  // Error handling middleware
  app.use(async (ctx, next) => {
    try {
      await next()
    } catch (err) {
      ctx.status = err.status || 500
      ctx.body = { error: err.message }
      ctx.app.emit('error', err, ctx)
    }
  })

  app.use(bodyParser())
  app.use(cors({ origin: '*' }))

  // Mount routes
  app.use(namesRouter.routes())
  app.use(namesRouter.allowedMethods())

  return app
}

module.exports = { createApp }
