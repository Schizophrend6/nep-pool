const config = {
  mocha: {
    timeout: 250000
  },
  plugins: ['solidity-coverage'],
  compilers: {
    solc: {
      version: '0.8.4',
      docker: false,
      settings: {
        optimizer: {
          enabled: true,
          runs: 200
        },
        evmVersion: 'byzantium'
      }
    }
  }
}

module.exports = config
