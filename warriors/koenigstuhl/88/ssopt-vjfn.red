;redcode
;name Sixth Sense vjfn
;author Wayne Sheppard
;strategy cmp scanner-SPL/JMP-Gate
;strategy Tweaked and upcycled by Steve G
;assert CORESIZE==8000

dist	equ	121
scan	equ	dist*2
safe	equ	off-Go+4

Go	add	off	,@x
loc	cmp	dist-1	,-1
	slt	#safe	,@x
	djn	-3	,<5994
	mov	j	,@loc
x	mov	s	,<loc
	sub	new	,@x
	jmn	loc	,loc-1
s	spl	0	,<1-dist
	mov	2	,<-2
j	jmp	-1	,#0
new	dat	<0-dist	,<0-dist-1
off	dat	#scan	,#scan

end	Go

