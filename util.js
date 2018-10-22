const util={}
util.asyncMap=function(arr,cb)
{
	return arr.reduce(async function(promiseArr,item)
	{
		return [...await promiseArr,await cb(item)]
	},Promise.resolve([]))
}
util.fetchFile=url=>fetch(url).then(res=>res.text())
//for old scripts that mutate the global scope
util.loadScript=function(src)
{
	return new Promise(function(onload,onerror)
	{
		document.head.appendChild
		(
			Object.assign(document.createElement('script'),{onerror,onload,src})
		)
	})
	.finally(rtn=>(rtn instanceof Error?{err:rtn}:{data:rtn}))
}
export default util