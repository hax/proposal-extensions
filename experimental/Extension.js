import { Call, ToObject, IsCallable, DefinePropertyOrThrow, ToLength } from './common/abstract.js'
import { ObjectCreate, OwnPropertyStringKeys, ThrowTypeError, IsClassConstructor } from './common/extra.js'
import InternalSlot from './common/InternalSlot.js'

import { SymbolExtension } from './ternary.js'
import { CreateExtMethod, CallExtMethod, CallExtGetter, CallExtSetter } from './binary.js'

const ExtensionMethods = InternalSlot()

function ExtensionGetMethod(extension, name) {
	const methods = ExtensionMethods.get(extension)
	const m = methods[name]
	if (m === undefined) ThrowTypeError()
	return m
}

export default class Extension {
	constructor(extensionMethods) {
		extensionMethods = ToObject(extensionMethods)
		const methods = ObjectCreate(null)
		for (const name of OwnPropertyStringKeys(extensionMethods)) {
			methods[name] = CreateExtMethod(extensionMethods[name])
		}
		ExtensionMethods.install(this, methods)
	}

	get [SymbolExtension]() { return this }

	invoke(receiver, name, args, O) {
		const m = ExtensionGetMethod(this, name)
		return CallExtMethod(m, receiver, args)
	}
	get(receiver, name, O) {
		const m = ExtensionGetMethod(this, name)
		return CallExtGetter(m, receiver)
	}
	set(receiver, name, V, O) {
		const m = ExtensionGetMethod(this, name)
		return CallExtSetter(m, receiver, V)
	}

	static from(source) {
		const ext = source[SymbolExtension]
		if (ext !== undefined) return ToObject(ext)
		if (IsConstructor(source)) return new Extension(CollectMethods(source.prototype, true), option)
		// for first-class protocol proposal
		// if (IsProtocol(source)) return new Extension(CreateMethodsFromProtocol(source), option)
		return new Extension(CollectMethods(source, false), option)
	}

	static method(value) {
		return ToMethod(value)
	}
	static accessor(get, set = undefined) {
		const result = {}
		if (get !== undefined && get !== null) result.get = ToMethod(get)
		if (set !== undefined && set !== null) result.set = ToMethod(set)
		return result
	}
}

function CollectMethods(O, isProto) {
	const names = OwnPropertyStringKeys(O)
	for (const k of names) {
		const v = isProto
			? ExtMethodFromPropDesc(GetOwnPropertyDescriptor(O, k))
			: ExtMethodFromMethod(O, k)
		if (v !== undefined) extension[k] = v
	}
	return extension
}

function ExtMethodFromPropDesc(pd) {
	if (pd === undefined) return undefined
	const {value, get, set} = pd
	if (get || set) return {get, set}
	if (IsCallable(value)) return value
	return undefined
}

function ExtMethodFromMethod(o, k) {
	const v = o[k]
	if (IsCallable(v) && !IsClassConstructor(v)) {
		return ToMethod(BindThisArg(v, o))
	}
	return undefined
}

function ToMethod(V) {
	if (!IsCallable(V)) throw new TypeError()
	if (IsClassConstructor(V)) throw new TypeError()
	const f = function (...args) {
		return V(this, ...args)
	}
	DefinePropertyOrThrow(f, 'name', {value: `method ${V.name}`})
	DefinePropertyOrThrow(f, 'length', {value: ToLength(V.length - 1)})
	return f
}

export function BindThisArg(F, O) {
	if (IsBoundFunction(F) || IsArrowFunction(F)) return F
	return Call(FunctionPrototypeBind, F, [O])
}
const FunctionPrototypeBind = Function.prototype.bind
