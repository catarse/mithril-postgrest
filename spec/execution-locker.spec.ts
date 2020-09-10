import { ExecutionLocker } from '../src/utils/execution-locker'

export default describe('ExecutionLocker', () => {

    describe('locking concurrent executions to provide the same result', () => {
        it('should resolve all requests to the same result', async () => {
            const locker = new ExecutionLocker()
            let count = 0
            const counter = async () => ++count

            const promiseResult1 = locker.lock('counter', counter)
            const promiseResult2 = locker.lock('counter', counter)
            const promiseResult3 = locker.lock('counter', counter)
            const results = await Promise.all([promiseResult1, promiseResult2, promiseResult3])

            expect(results[0]).toEqual(count)
            expect(results[1]).toEqual(count)
            expect(results[2]).toEqual(count)
        })

        it('should resolve all request to the same value when waiting for the last one', async () => {
            const locker = new ExecutionLocker()
            let count = 0
            const counter = async () => ++count

            const promiseResult1 = locker.lock('counter', counter)
            const promiseResult2 = locker.lock('counter', counter)
            const result3 = await locker.lock('counter', counter)
            const result1 = await promiseResult1
            const result2 = await promiseResult2

            expect(result1).toEqual(count)
            expect(result2).toEqual(count)
            expect(result3).toEqual(count)
        })

        it('should resolve to different values when waiting individual results', async () => {
            const locker = new ExecutionLocker()
            let count = 0
            const counter = async () => ++count

            const result1 = await locker.lock('counter', counter)
            const result2 = await locker.lock('counter', counter)
            const result3 = await locker.lock('counter', counter)

            expect(result1).toEqual(1)
            expect(result2).toEqual(2)
            expect(result3).toEqual(3)
        })
    })
})