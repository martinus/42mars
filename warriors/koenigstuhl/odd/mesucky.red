;redcode
;name MESUCKY
;author brx
;strategy it's a lame thingy..
;assert 1
;         CORESIZE == 800

CDIST	equ 267
LEN		equ	3

init	spl.a 1, <-11
		spl.a 1, <-12
		
dinit	spl.a	CDIST+ptr+LEN-1
copy	mov		{ptr,			<ptr
		mov		ptr,			<(copy-1)
		spl.a	-1,				<-32
		jmp.a	-1,				<-33
ptr		dat		#0,				#(CDIST+LEN+1)

