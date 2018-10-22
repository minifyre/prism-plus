import util from './util.js'
const prism={util}
export default prism

const {asyncMap,fetchFile,loadScript}=util
//core
prism.getPeerDependents=function(mainLanguage)
{
	if(!prism.peerDependentsMap) prism.peerDependentsMap=prism.getPeerDependentsMap()

	return prism.peerDependentsMap[mainLanguage]||[]
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
prism.load=async function()//core & components list
{
	const
	url='./node_modules/prism/',
	{err}=await loadScript(url+'components/prism-core.js')
	if(err) return console.error(err)
	Object.assign(Prism.util,util)//preserve custom utils
	Object.assign(prism,window.Prism)//merge with real prism object
	window.Prism=undefined

	//get available langs, themes, & plugins

	prism.components=await fetchFile(url+'components.js')
	.then(body=>new Function('components',body+'return components')())

	//show all loadable langs
	Object.entries(prism.components.languages)
	.filter(([key])=>key!=='meta')
	.forEach(function([key,val])
	{
		const
		{alias}=val,
		aliases=!alias?[]:
				Array.isArray(alias)?alias:[alias]

		aliases.concat([key]).forEach(lang=>prism.languages[lang]=false)
	})
	//show loadable themes
	prism.themes={}
	Object.entries(prism.components.themes)
	.filter(([key])=>key!=='meta')
	.forEach(([key,theme])=>prism.themes[theme.title||theme]=false)
	//@todo show loadable plugins

	//load default langs
	await prism.loadLanguages(['html','css','js','css-extras'])

	return prism
}
//without dependencies prevents reloading langs to avoid avoid circular references
//@todo use rest params and just check if the last one is false
prism.loadLanguages=async function(aliases=[],withoutDependencies=false)
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

	await asyncMap(arr,async function(lang)
	{
		const definition=prism.components.languages[lang]

		if(!definition) return console.warn('Language does not exist '+lang)

		// Load dependencies first
		if(!withoutDependencies&&definition.require) await prism.loadLanguages(definition.require)

		delete prism.languages[lang]

		await fetchFile(`./node_modules/prism/components/prism-${lang}.js`)
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

		if(dependents.length) prism.loadLanguages(dependents,true)
		
		return
	})
}
prism.loadThemes=async function(...themes2load)
{
	const
	{themes}=prism.components,
	themeKeys=themes2load.map(function(name)
	{
		return themes[name]||
		Object.entries(themes).find(function([key,theme])
		{
			return theme===name||theme.title===name
		})[0]
	})
	//@don't reload previously loaded themes, or themes that don't exist (undefined)
	.filter(theme=>prism.themes[theme]===false),
	keyPairs=await asyncMap(themeKeys,async function(theme)
	{
		const code=await fetchFile('./node_modules/prism/themes/'+theme+'.css')

		return [theme,code]
	})

	keyPairs.forEach(([key,val])=>prism.themes[key]=val)
}