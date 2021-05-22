/* eslint-disable no-unused-expressions */

const BigNumber = require('bignumber.js')
require('chai').use(require('chai-as-promised')).use(require('chai-bignumber')(BigNumber)).should()

const Pool = artifacts.require('./NepPool')
const NTransferUtilV1 = artifacts.require('./NTransferUtilV1')
const MaliciousToken = artifacts.require('./MaliciousToken')
const NTransferUtilV1Intermediate = artifacts.require('./NTransferUtilV1Intermediate')
const Destroyable = artifacts.require('./Destroyable')
const FakeToken = artifacts.require('./Token')
const { advanceByBlocks } = require('./blocks')

const minStakingPeriodInBlocks = 12
const ZERO_X = '0x0000000000000000000000000000000000000000'
const toWei = x => { return web3.utils.toWei(x.toString()) }
const ether = 1000000000000000000
const million = 1000000

BigNumber.config({ EXPONENTIAL_AT: 30 })

contract('NEP Pool', function (accounts) {
  const [owner, alice, bob, mallory, treasury] = accounts // eslint-disable-line
  let nepToken, pool, TransferLib

  before(async () => {
    TransferLib = await NTransferUtilV1.new()
    await Pool.link('NTransferUtilV1', TransferLib.address)
    await NTransferUtilV1Intermediate.link('NTransferUtilV1', TransferLib.address)
  })

  describe('NTransferUtilV1', () => {
    let intermediate, evil, nonEvil

    beforeEach(async () => {
      const amount = BigNumber(500 * million * ether)
      evil = await MaliciousToken.new()
      nonEvil = await FakeToken.new('Non Evil', 'NEV', amount)

      intermediate = await NTransferUtilV1Intermediate.new()
      await evil.mint(owner, amount)

      await evil.transfer(intermediate.address, BigNumber(1000 * ether))
      await nonEvil.transfer(intermediate.address, BigNumber(1000 * ether))

      await evil.transfer(alice, BigNumber(1000 * ether))
      await nonEvil.transfer(alice, BigNumber(1000 * ether))
    })

    it('accepts non-malicious transfers', async () => {
      await intermediate.iTransfer(nonEvil.address, alice, BigNumber(100)).should.not.be.rejected
    })

    it('rejects transfer to zero address', async () => {
      await intermediate.iTransfer(nonEvil.address, ZERO_X, BigNumber(1)).should.be.rejectedWith('Invalid recipient')
    })

    it('rejects zero value transfers', async () => {
      await intermediate.iTransfer(nonEvil.address, alice, '0').should.be.rejectedWith('Invalid transfer amount')
    })

    it('rejects malicious transfers', async () => {
      await intermediate.iTransfer(evil.address, alice, BigNumber(100)).should.be.rejectedWith('Invalid transfer')
    })

    it('accepts non-malicious approved transfers', async () => {
      await nonEvil.approve(intermediate.address, BigNumber(100), { from: alice })
      await intermediate.iTransferFrom(nonEvil.address, alice, bob, BigNumber(100), { from: alice }).should.not.be.rejected
    })

    it('rejects zero value approved transfers', async () => {
      await nonEvil.approve(intermediate.address, BigNumber(100), { from: alice })
      await intermediate.iTransferFrom(nonEvil.address, alice, bob, '0', { from: alice }).should.be.rejectedWith('Invalid transfer amount')
    })

    it('rejects approved transfers to zero address', async () => {
      await nonEvil.approve(intermediate.address, BigNumber(100), { from: alice })
      await intermediate.iTransferFrom(nonEvil.address, alice, ZERO_X, BigNumber(100), { from: alice }).should.be.rejectedWith('Invalid recipient')
    })

    it('rejects malicious approved transfers', async () => {
      await evil.approve(intermediate.address, BigNumber(100), { from: alice })
      await intermediate.iTransferFrom(evil.address, alice, bob, BigNumber(100), { from: alice }).should.be.rejectedWith('Invalid transfer')
    })
  })

  describe('Deployment', () => {
    before(async () => {
      nepToken = await FakeToken.new('NEP', 'NEP', BigNumber(100 * million * ether))
      pool = await Pool.new(nepToken.address, treasury)
    })

    it('correctly deployed', async () => {
      ; (await pool._nepToken()).should.equal(nepToken.address)
      ; (await pool._treasury()).should.equal(treasury)
      ; (await pool.owner()).should.equal(owner)
    })
  })

  describe('Add or Update Liquidity', () => {
    const liquidityTokens = {}

    beforeEach(async () => {
      nepToken = await FakeToken.new('NEP', 'NEP', BigNumber(10000 * million * ether))
      pool = await Pool.new(nepToken.address, treasury)

      liquidityTokens.wbnb = await FakeToken.new('WBNB', 'WBNB', BigNumber(100 * million * ether))
      liquidityTokens.nepbusd = await FakeToken.new('NEP-BUSD', 'NEP-BUSD', BigNumber(100 * million * ether))
    })

    it('correctly adds liquidity (NEP)', async () => {
      const name = 'NEP Farm'
      const maxStake = BigNumber('4000000000000000000000000')
      const nepUnitPerTokenUnitPerBlock = BigNumber('142694063927')
      const entryFee = '0'
      const exitFee = '0'
      const amount = BigNumber('6000000000000000000000000')

      await nepToken.approve(pool.address, amount)

      await pool.addOrUpdateLiquidity(nepToken.address, name, maxStake, nepUnitPerTokenUnitPerBlock, entryFee, exitFee, minStakingPeriodInBlocks, amount)

      const balance = await pool.getTotalNEPLocked()
      balance.toString().should.equal(amount.toString())
    })

    it('correctly updates liquidity pool without transfers', async () => {
      const name = 'NEP Farm'
      const maxStake = BigNumber('4000000000000000000000000')
      const nepUnitPerTokenUnitPerBlock = BigNumber('142694063927')
      const entryFee = '0'
      const exitFee = '0'
      const amount = BigNumber('0')

      await nepToken.approve(pool.address, amount)

      await pool.addOrUpdateLiquidity(nepToken.address, name, maxStake, nepUnitPerTokenUnitPerBlock, entryFee, exitFee, minStakingPeriodInBlocks, amount)

      const balance = await nepToken.balanceOf(pool.address)
      balance.toString().should.equal(amount.toString())
    })

    it('does not allow zero address', async () => {
      const name = 'NEP Farm'
      const maxStake = BigNumber('4000000000000000000000000')
      const nepUnitPerTokenUnitPerBlock = BigNumber('142694063927')
      const entryFee = '0'
      const exitFee = '0'
      const amount = BigNumber('0')

      await nepToken.approve(pool.address, amount)

      await pool.addOrUpdateLiquidity(ZERO_X, name, maxStake, nepUnitPerTokenUnitPerBlock, entryFee, exitFee, minStakingPeriodInBlocks, amount).should.be.rejectedWith('Invalid token')
    })

    it('must provide a value for max stake', async () => {
      const name = 'NEP Farm'
      const maxStake = BigNumber('0')
      const nepUnitPerTokenUnitPerBlock = BigNumber('142694063927')
      const entryFee = '0'
      const exitFee = '0'
      const amount = BigNumber('0')

      await nepToken.approve(pool.address, amount)

      await pool.addOrUpdateLiquidity(nepToken.address, name, maxStake, nepUnitPerTokenUnitPerBlock, entryFee, exitFee, minStakingPeriodInBlocks, amount).should.be.rejectedWith('Invalid maximum stake amount')
    })
  })

  describe('Owner features', () => {
    before(async () => {
      nepToken = await FakeToken.new('NEP', 'NEP', BigNumber(100 * million * ether))
      pool = await Pool.new(nepToken.address, treasury)
    })

    it('treasury can not be a ZERO address', async () => {
      await pool.updateTreasury(ZERO_X).should.be.rejectedWith('Invalid address')
    })

    it('allows owner to set the treasury', async () => {
      await pool.updateTreasury(mallory).should.not.be.rejected
    })

    it('allows owner to set min staking blocks', async () => {
      await pool.setMinStakingPeriodInBlocks(nepToken.address, '1000').should.not.be.rejected
    })

    it('new treasury can not be the old treasury', async () => {
      await pool.updateTreasury(mallory).should.be.rejectedWith('Provide a new address')
    })
  })

  describe('Recoverable', () => {
    before(async () => {
      nepToken = await FakeToken.new('NEP', 'NEP', BigNumber(100 * million * ether))
      pool = await Pool.new(nepToken.address, treasury)
    })

    it('allows recovering accidental BNB transfers', async () => {
      const destroyable = await Destroyable.new({
        value: toWei(10)
      })

      await destroyable.destroy(pool.address)
      let balance = await web3.eth.getBalance(pool.address)
      balance.toString().should.equal(toWei(10))

      await pool.recoverEther()

      balance = await web3.eth.getBalance(pool.address)
      balance.toString().should.equal('0')
    })

    it('allows recovering accidental token transfers', async () => {
      const fakeToken = await FakeToken.new('Fake', 'Fake', toWei(1000000))
      fakeToken.transfer(pool.address, toWei(100))

      let balance = await fakeToken.balanceOf(pool.address)
      balance.toString().should.equal(toWei(100))

      await pool.recoverToken(fakeToken.address)

      balance = await fakeToken.balanceOf(pool.address)
      balance.toString().should.equal('0')
    })
  })

  describe('Deposits', () => {
    let farms

    beforeEach(async () => {
      nepToken = await FakeToken.new('NEP', 'NEP', BigNumber(10000 * million * ether))
      pool = await Pool.new(nepToken.address, treasury)

      const wbnb = await FakeToken.new('WBNB', 'WBNB', BigNumber(100000 * million * ether))
      const nepbusd = await FakeToken.new('NEP-BUSD', 'NEP-BUSD', BigNumber(10000 * million * ether))

      farms = [{
        token: nepToken,
        name: 'NEP Farm',
        maxStake: BigNumber('4000000000000000000000000'),
        entryFee: '0',
        exitFee: '0',
        amount: BigNumber('6000000000000000000000000'),
        nepUnitPerTokenUnitPerBlock: BigNumber('142694063927')
      }, {
        token: nepbusd,
        name: 'NEP-BUSD Farm',
        maxStake: BigNumber('2000000000000000000000000'),
        entryFee: '0',
        exitFee: '0',
        amount: BigNumber('2800000000000000000000000'),
        nepUnitPerTokenUnitPerBlock: BigNumber('133181126332')
      }, {
        token: wbnb,
        name: 'WBNB Farm',
        maxStake: BigNumber('2500000000000000000000'),
        entryFee: '25000',
        exitFee: '0',
        amount: BigNumber('640000000000000000000000'),
        nepUnitPerTokenUnitPerBlock: BigNumber('24353120243531')
      }]

      for (let i = 0; i < farms.length; i++) {
        const { token, name, nepUnitPerTokenUnitPerBlock, maxStake, entryFee, exitFee, amount } = farms[i]

        await pool.addOrUpdateLiquidity(token.address, name, maxStake, nepUnitPerTokenUnitPerBlock, entryFee, exitFee, minStakingPeriodInBlocks, '0')

        await token.transfer(pool.address, amount)
        await nepToken.balanceOf(pool.address)
      }
    })

    it('rejects zero value deposits', async () => {
      const { token } = farms[0]
      const amount = BigNumber(0 * ether)

      await token.approve(pool.address, amount)
      await pool.deposit(token.address, amount).should.be.rejectedWith('Invalid amount')
    })

    it('successfully deposits liquidity tokens to the farm', async () => {
      for (let i = 0; i < farms.length; i++) {
        const { token } = farms[i]
        const amount = BigNumber(10 * ether)
        const locked = amount.minus(amount.multipliedBy(farms[i].entryFee || '0').dividedBy('1000000'))

        await token.approve(pool.address, amount)
        await pool.deposit(token.address, amount)

        const staked = await pool.totalStaked(token.address, owner)
        const totalLocked = await pool.getTotalLocked(token.address)

        staked.toString().should.equal(locked.toString())
        totalLocked.toString().should.equal(locked.toString())
      }
    })

    it('stops accepting deposits when the target is reached', async () => {
      const { token, maxStake } = farms[0]

      await token.approve(pool.address, maxStake)
      await pool.deposit(token.address, maxStake).should.not.be.rejected
      await pool.deposit(token.address, '1').should.be.rejectedWith('that exceeds target')
    })

    it('rejects deposits which exceed the cap', async () => {
      const { token, maxStake } = farms[0]

      await pool.deposit(token.address, maxStake.plus(1)).should.be.rejectedWith('that exceeds target')
    })
  })

  describe('Withdrawals', () => {
    let farms

    beforeEach(async () => {
      nepToken = await FakeToken.new('NEP', 'NEP', BigNumber(10000 * million * ether))
      pool = await Pool.new(nepToken.address, treasury)

      const wbnb = await FakeToken.new('WBNB', 'WBNB', BigNumber(100000 * million * ether))
      const nepbusd = await FakeToken.new('NEP-BUSD', 'NEP-BUSD', BigNumber(10000 * million * ether))

      farms = [{
        token: nepToken,
        name: 'NEP Farm',
        maxStake: BigNumber('4000000000000000000000000'),
        entryFee: '0',
        exitFee: '0',
        amount: BigNumber('6000000000000000000000000'),
        nepUnitPerTokenUnitPerBlock: BigNumber('142694063927')
      }, {
        token: nepbusd,
        name: 'NEP-BUSD Farm',
        maxStake: BigNumber('2000000000000000000000000'),
        entryFee: '0',
        exitFee: '0',
        amount: BigNumber('2800000000000000000000000'),
        nepUnitPerTokenUnitPerBlock: BigNumber('133181126332')
      }, {
        token: wbnb,
        name: 'WBNB Farm',
        maxStake: BigNumber('2500000000000000000000'),
        entryFee: '25000',
        exitFee: '1000000',
        amount: BigNumber('640000000000000000000000'),
        nepUnitPerTokenUnitPerBlock: BigNumber('24353120243531')
      }]

      for (let i = 0; i < farms.length; i++) {
        const { token, name, nepUnitPerTokenUnitPerBlock, maxStake, entryFee, exitFee, amount } = farms[i]

        await pool.addOrUpdateLiquidity(token.address, name, maxStake, nepUnitPerTokenUnitPerBlock, entryFee, exitFee, minStakingPeriodInBlocks, '0')

        await token.transfer(pool.address, amount)
        await nepToken.balanceOf(pool.address)
      }
    })

    it('reject zero value withdrawals', async () => {
      const { token } = farms[0]
      const amount = BigNumber(0 * ether)

      await pool.withdraw(token.address, amount).should.be.rejectedWith('Invalid amount')
    })

    it('successfully withdraws staked liquidity tokens from the farm', async () => {
      const { token } = farms[0]
      const amount = BigNumber(10 * ether)

      await token.approve(pool.address, amount)
      await pool.deposit(token.address, amount)

      await advanceByBlocks(minStakingPeriodInBlocks)

      let staked = await pool.totalStaked(token.address, owner)
      staked.toString().should.equal(amount.toString())

      await pool.withdraw(token.address, amount)

      staked = await pool.totalStaked(token.address, owner)
      staked.toString().should.equal('0')
    })

    it('successfully transfers the exit fees to treasury', async () => {
      const { token } = farms[2]
      const amount = BigNumber(10 * ether)
      const locked = amount.minus(amount.multipliedBy(farms[2].entryFee || '0').dividedBy('1000000'))
      const exitFee = locked.multipliedBy(farms[2].exitFee || '0').dividedBy('1000000')

      await token.approve(pool.address, amount)
      await pool.deposit(token.address, amount)

      await advanceByBlocks(minStakingPeriodInBlocks)

      let staked = await pool.totalStaked(token.address, owner)
      staked.toString().should.equal(locked.toString())

      let treasuryBalance = await token.balanceOf(treasury)
      await pool.withdraw(token.address, locked)

      staked = await pool.totalStaked(token.address, owner)
      staked.toString().should.equal('0')

      const expectedBalance = BigNumber(treasuryBalance.toString()).plus(exitFee)

      treasuryBalance = await token.balanceOf(treasury)
      treasuryBalance.toString().should.equal(expectedBalance.toString())
    })

    it('rejects request to withdraw amount exceeding balance', async () => {
      const { token } = farms[0]
      const amount = BigNumber(10 * ether)

      await token.approve(pool.address, amount)
      await pool.deposit(token.address, amount)

      await advanceByBlocks(minStakingPeriodInBlocks)

      const staked = await pool.totalStaked(token.address, owner)
      staked.toString().should.equal(amount.toString())

      await pool.withdraw(token.address, amount.plus(1)).should.be.rejectedWith('Try again')
    })

    it('rejects early withdrawals', async () => {
      const { token } = farms[0]
      const amount = BigNumber(10 * ether)

      await token.approve(pool.address, amount)
      await pool.deposit(token.address, amount)

      await pool.withdraw(token.address, amount).should.be.rejectedWith('too early')
    })
  })

  describe('Withdraw Rewards', () => {
    let farms

    beforeEach(async () => {
      nepToken = await FakeToken.new('NEP', 'NEP', BigNumber(10000 * million * ether))
      pool = await Pool.new(nepToken.address, treasury)

      const wbnb = await FakeToken.new('WBNB', 'WBNB', BigNumber(100000 * million * ether))
      const nepbusd = await FakeToken.new('NEP-BUSD', 'NEP-BUSD', BigNumber(10000 * million * ether))

      farms = [{
        token: nepToken,
        name: 'NEP Farm',
        maxStake: BigNumber('4000000000000000000000000'),
        entryFee: '0',
        exitFee: '0',
        amount: BigNumber('6000000000000000000000000'),
        nepUnitPerTokenUnitPerBlock: BigNumber('142694063927')
      }, {
        token: nepbusd,
        name: 'NEP-BUSD Farm',
        maxStake: BigNumber('2000000000000000000000000'),
        entryFee: '0',
        exitFee: '0',
        amount: BigNumber('2800000000000000000000000'),
        nepUnitPerTokenUnitPerBlock: BigNumber('133181126332')
      }, {
        token: wbnb,
        name: 'WBNB Farm',
        maxStake: BigNumber('2500000000000000000000'),
        entryFee: '25000',
        exitFee: '0',
        amount: BigNumber('640000000000000000000000'),
        nepUnitPerTokenUnitPerBlock: BigNumber('24353120243531')
      }]

      for (let i = 0; i < farms.length; i++) {
        const { token, name, nepUnitPerTokenUnitPerBlock, maxStake, entryFee, exitFee, amount } = farms[i]

        await pool.addOrUpdateLiquidity(token.address, name, maxStake, nepUnitPerTokenUnitPerBlock, entryFee, exitFee, minStakingPeriodInBlocks, '0')

        await token.transfer(pool.address, amount)
        await nepToken.balanceOf(pool.address)

        await token.approve(pool.address, BigNumber(10 * ether))
        await pool.deposit(token.address, BigNumber(10 * ether))
      }
    })

    it('successfully withdraws the staking rewards', async () => {
      await advanceByBlocks(100)

      for (let i = 0; i < farms.length; i++) {
        const { token } = farms[i]
        const tx = await pool.withdrawRewards(token.address)
        const { receipt: { logs } } = tx

        const [rewardsWithdrawn] = logs

        rewardsWithdrawn.event.should.equal('RewardsWithdrawn')
        rewardsWithdrawn.args.token.should.equal(token.address)
        rewardsWithdrawn.args.account.should.equal(owner)
      }
    })

    it('completes even if there is no reward', async () => {
      await advanceByBlocks(10)
      const { token } = farms[0]

      pool.withdraw(token.address, BigNumber(10 * ether))
      await pool.withdrawRewards(token.address).should.not.be.rejected
    })
  })

  describe('Other Features', () => {
    let farm

    beforeEach(async () => {
      nepToken = await FakeToken.new('NEP', 'NEP', BigNumber(10000 * million * ether))
      pool = await Pool.new(nepToken.address, treasury)

      farm = {
        token: nepToken,
        name: 'NEP Farm',
        maxStake: BigNumber('4000000000000000000000000'),
        entryFee: '0',
        exitFee: '0',
        amount: BigNumber('6000000000000000000000000'),
        nepUnitPerTokenUnitPerBlock: BigNumber('142694063927')
      }

      const { token, name, nepUnitPerTokenUnitPerBlock, maxStake, entryFee, exitFee, amount } = farm

      await pool.addOrUpdateLiquidity(token.address, name, maxStake, nepUnitPerTokenUnitPerBlock, entryFee, exitFee, minStakingPeriodInBlocks, '0')

      await token.transfer(pool.address, amount)
      await nepToken.balanceOf(pool.address)
    })

    it('correctly returns the withdrawalable block number', async () => {
      const { token } = farm
      const amount = BigNumber(10 * ether)

      await token.approve(pool.address, amount)
      const tx = await pool.deposit(token.address, amount)
      const expectation = tx.receipt.blockNumber + minStakingPeriodInBlocks

      const actual = await pool.canWithdrawFrom(token.address, owner)
      actual.toString().should.equal(expectation.toString())
    })

    it('returns getInfo without error', async () => {
      const { token } = farm
      await pool.getInfo(token.address).should.not.be.rejected
    })

    it('allows pausing the contract', async () => {
      await pool.pause().should.not.be.rejected
      await pool.pause().should.be.rejected
    })

    it('allows unpausing the contract', async () => {
      await pool.unpause().should.be.rejected
      await pool.pause().should.not.be.rejected
      await pool.unpause().should.not.be.rejected
    })
  })
})
