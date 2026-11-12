;redcode
;name Anti-Lethal-Jump
;author Will 'Varfar'
;assert 1

org start

start	jmz.f start, }ptr
ptr	jmz.f {MINDISTANCE-6, ptr
	jmz.f ptr, empty

empty end
 
