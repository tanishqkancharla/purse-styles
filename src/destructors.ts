export type Destructor = () => void

export function joinDestructors(destructors: Destructor[]) {
	return () => {
		destructors.forEach((destructor) => destructor())
	}
}
