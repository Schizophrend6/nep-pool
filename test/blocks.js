const { promisify } = require('util')
const send = promisify(web3.currentProvider.send)

const advanceByBlocks = async count => {
  const id = new Date().getTime()

  for (let i = 0; i < count; i++) {
    await advanceByBlock(id + i)
  }
}

const advanceByBlock = async (id) => {
  return new Promise((resolve, reject) => {
    send({
      jsonrpc: '2.0',
      method: 'evm_mine',
      id
    }, function (err, result) {
      if (err) {
        reject(err)
      }

      resolve(result)
    })
  })
}

const advanceToTime = async (when) => {
  return new Promise((resolve, reject) => {
    send({
      jsonrpc: '2.0',
      method: 'evm_increaseTime',
      params: [when],
      id: new Date().getTime()
    }, function (err, result) {
      if (err) {
        reject(err)
      }

      resolve(result)
    })
  })
}

module.exports = { advanceByBlocks, advanceToTime }
