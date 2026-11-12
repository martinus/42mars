;redcode
;name familiar...just kiddin
;author Paul Khuong
;strategy Vampire (weird mutation...)
;assert 1

gate	equ	fang-3
dest	equ	pit+3

fang: 	jmp	-2,	#dest
dbmb:	dat.f	0,	(dest)-(gate)

start:	mov	fang,	<fang
inc:	add.x	#4,	-3	;step 3 vamp :/
	djn	start,	#2665
	djn.f	start,	*0
pit:	mov	dbmb,	>gate
	djn.f	-1,	>gate

end start

