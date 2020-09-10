/**
 * Execution locker creates a handle for promises that need to be waited.
 * It's a queued execution of promises based on a unique key externally
 * provided.
 */
export class ExecutionLocker {
    private keys : { [key:string] : boolean } = {}
    private locked : { [key:string] : Promise<any> } = {}
    private promisesInternalResolversRejecters : { [key:string] : ({ resolve : (v : any) => void, reject : (v : any) => void })[] } = {}

    async lock<ReturnType>(key : string, asyncFunction : () => Promise<ReturnType>) : Promise<ReturnType> {
        try {
            if (!this.keys[key]) {
                this.keys[key] = true
                this.locked[key] = asyncFunction()
                const result = await this.locked[key]
                this.resolveAllWithResultOnKey(key, result)
                return result
            } else {
                return await this.waitForWorkOn(key)
            }
        } catch(error) {
            this.rejectAllWithErroOnKey(key, error)
            throw error
        } finally {
            this.keys[key] = false
        }
    }

    private async resolveAllWithResultOnKey(key : string, result : any) : Promise<void> {
        if (key in this.promisesInternalResolversRejecters) {
            const resolvers = this.promisesInternalResolversRejecters[key].map(({ resolve }) => resolve)
            for (const resolveWith of resolvers) {
                resolveWith(result)
            }
            
            delete this.promisesInternalResolversRejecters[key]
        }        
    }

    private async waitForWorkOn(key : string) : Promise<any> {
        const promiseInternal = {
            resolve: (v : any) => {},
            reject: (v : any) => {},
        }

        this.promisesInternalResolversRejecters[key] = this.promisesInternalResolversRejecters[key] || []

        const resultPromise = new Promise<any>((resolve, reject) => {
            promiseInternal.resolve = resolve
            promiseInternal.reject = reject            
            this.promisesInternalResolversRejecters[key].push(promiseInternal)
        })
        
        return await resultPromise
    }

    private async rejectAllWithErroOnKey(key : string, error : Error) {
        if (key in this.promisesInternalResolversRejecters) {
            const rejecters = this.promisesInternalResolversRejecters[key].map(({ reject }) => reject)
            for (const rejectWith of rejecters) {
                rejectWith(error)
            }

            delete this.promisesInternalResolversRejecters[key]
        }
    }
}