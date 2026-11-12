;redcode
;name Anti-Lethal-Jump
;author Will 'Varfar'
;assert 1

org start

empty equ ptr-1 

ptr	jmz.f >MINDISTANCE-6, ptr
	jmz.f *ptr, empty
start	jmz.f start, }ptr
	jmz.f ptr, empty

end
