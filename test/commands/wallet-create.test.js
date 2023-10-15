'use strict';
var chai = require('chai');
var expect = require('chai').expect;
var chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
var index = require('../../dist/index.js');

describe('wallet-create', () => {
   it('success', async () => {
      const result = await index.Atomicals.walletCreate();
      expect(result.success).to.be.true;
      expect(result.data.phrase).to.not.equal(undefined)
      expect(result.data.primary.WIF).to.not.equal(undefined)
      expect(result.data.primary.address).to.not.equal(undefined)
      expect(result.data.primary.privateKey).to.not.equal(undefined)
      expect(result.data.primary.publicKey).to.not.equal(undefined)
      expect(result.data.primary.publicKeyXOnly).to.not.equal(undefined)
      expect(result.data.primary.path).to.not.equal(undefined)
      expect(result.data.funding.WIF).to.not.equal(undefined)
      expect(result.data.funding.address).to.not.equal(undefined)
      expect(result.data.funding.privateKey).to.not.equal(undefined)
      expect(result.data.funding.publicKey).to.not.equal(undefined)
      expect(result.data.funding.publicKeyXOnly).to.not.equal(undefined)
      expect(result.data.funding.path).to.not.equal(undefined)
 
   });
});
 