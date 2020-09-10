import prop from 'mithril/stream'

export default function paginationVM(mithilInstance) {
    const m = mithilInstance;
    return (model, order, extraHeaders = {}, authenticate = true) => {
        const collection = prop([])
        const defaultOrder = order || 'id.desc'
        const filters = prop({ order: defaultOrder })
        const isLoading = prop(false)
        const page = prop(1)
        const resultsCount = prop<number>()
        const pageRequest = authenticate ? model.getPageWithToken : model.getPage
        const total = prop<number>()

        const fetch = async () => {
            try {
                isLoading(true)
                const config = {
                    background: false,
                    extract: getTotal
                }
                const data = await pageRequest(filters(), page(), config, extraHeaders)
                collection([...collection(), ...data])
                return collection()
            } catch(error) {
                total(0)
                throw error
            } finally {
                isLoading(false)
            }
        }

        const firstPage = (parameters) => {
            filters(Object.assign({ order: defaultOrder }, parameters))
            collection([])
            page(1)
            return fetch()
        }

        const isLastPage = () => {
            return (model.pageSize() > resultsCount())
        }

        const nextPage = () => {
            page(page() + 1)
            return fetch()
        }

        const getTotal = (xhr) => {
            if (!xhr || xhr.status === 0) {
                return JSON.stringify({
                    hint: null,
                    details: null,
                    code: 0,
                    message: 'Connection error'
                })
            }
            
            let rangeHeader = xhr.getResponseHeader('Content-Range')

            if (typeof rangeHeader === 'string') {
                const [headerSize, headerCount] = rangeHeader.split('/')
                const [headerFrom, headerTo] = headerSize.split('-')
                const to = parseInt(headerTo) + 1 || 0
                const from = parseInt(headerFrom) || 0

                total(parseInt(headerCount))
                resultsCount(to - from)
            }

            try {
                return JSON.parse(xhr.responseText)
            } catch (ex) {
                return JSON.stringify({
                    hint: null,
                    details: null,
                    code: 0,
                    message: xhr.responseText
                })
            }
        }

        return {
            collection,
            firstPage,
            isLoading,
            nextPage,
            isLastPage,
            total,
            resultsCount
        }
    }
}