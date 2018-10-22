const prism={util:{}}
export default prism
prism.load=async function()
{
	const
	url='./node_modules/prism/',
	{err}=await prism.util.loadScript(url+'components/prism-core.js')
	if(err) return console.error(err)
	Object.assign(Prism.util,prism.util)//preserve custom utils
	Object.assign(prism,window.Prism)//merge with real prism object
	window.Prism=undefined

	//get available langs, themes, & plugins
	prism.components=await fetch(url+'components.js')
	.then(res=>res.text())
	.then(body=>new Function('components',body+'return components')())

	//show all loadable langs
	Object.entries(prism.components.languages)
	.forEach(function([lang,val])
	{
		if(lang==='meta') return
		const
		{alias}=val,
		aliases=!alias?[]:
				Array.isArray(alias)?alias:[alias]

		aliases.concat([lang]).forEach(lang=>prism.languages[lang]=false)
	})
	//@todo show loadable themes
	//@todo show loadable plugins

	//load default langs
	await prism.loadLanguages(prism,['html','css','js'])

	return prism
}
//without dependencies prevents reloading langs to avoid avoid circular references
prism.loadLanguages=async function(prism,aliases=[],withoutDependencies=false)
{
	const
	langs=(Array.isArray(aliases)?aliases:[aliases])
	.filter(x=>x!=='meta')
	.map(function(alias)
	{//convert aliases to language names
		const val=prism.components.languages[alias]
		return val?[alias,val]:Object.entries(prism.components.languages)
		.find(function([_,val])
		{
			if(!val.alias) return
			const aliases=Array.isArray(val.alias)?val.alias:[val.alias]
			return aliases.indexOf(alias)!==-1
		})
	})
	.map(([key])=>key),
	// If no argument is passed, load all components
	arr=!langs.length?Object.keys(prism.components.languages):langs

	if(!arr.length) return

	await prism.util.asyncMap(arr,async function(lang)
	{
		const definition=prism.components.languages[lang]

		if(!definition) return console.warn('Language does not exist '+lang)

		// Load dependencies first
		if(!withoutDependencies&&definition.require) await prism.loadLanguages(prism,definition.require)

		delete prism.languages[lang]
		await fetch(`./node_modules/prism/components/prism-${lang}.js`)
		.then(res=>res.text())
		.then(body=>new Function('Prism',body)(prism))

		// Reload dependents
		const dependents=prism.getPeerDependents(lang)
		.filter(function(dependent)
		{
			// If dependent language was already loaded,
			// we want to reload it.
			if(prism.languages[dependent])
			{
				delete Prism.languages[dependent]
				return true
			}
			return false
		})

		if(dependents.length) prism.loadLanguages(prism,dependents,true)
		
		return
	})
}
prism.getPeerDependentsMap=function()
{
	return Object.entries(prism.components.languages)
	.reduce(function(peerDependentsMap,[language,value])
	{
		const {peerDependencies}=value

		if(!peerDependencies) return peerDependentsMap//ignores meta as well

		;(Array.isArray(peerDependencies)?peerDependencies:[peerDependencies])
		.forEach(function(depenency)
		{
			if(!peerDependentsMap[depenency]) peerDependentsMap[depenency]=[]

			peerDependentsMap[depenency].push(language)
		})

		return peerDependentsMap
	},{})
}
prism.getPeerDependents=function(mainLanguage)
{
	if(!prism.peerDependentsMap) prism.peerDependentsMap=prism.getPeerDependentsMap()

	return prism.peerDependentsMap[mainLanguage]||[]
}
//util
prism.util.asyncMap=function(arr,cb)
{
	return arr.reduce(async function(promiseArr,item)
	{
		return [...await promiseArr,await cb(item)]
	},Promise.resolve([]))
}
//for old scripts that mutate the global scope
prism.util.loadScript=function(src)
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