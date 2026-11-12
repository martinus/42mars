;redcode-94x
;name Mayii
;author David Houston
;assert CORESIZE == 8000
;strategy Track down our little brother Luke.
;strategy Train him.
;strategy Exorcise bully.

ffirst	equ	-1000
fstep	equ	-108

oboot	equ	5174
oboot2	equ	1120
sboot	equ	6279

; This looks like the decrement stream
mdec	dat	-1, 0
; This looks like the last op in our little brother.
msib	jmp	-2, }-2


; Scan for the decrement stream
dsl	add	#fstep, fptr
ds	sne	<fptr, <fptr
	add	#fstep, fptr
	sne	<fptr, <fptr
fadj	jmp	dsl, #(sibpap + fadj - fptr)

; Test to see if this is the decrement stream
	seq	mdec, <fptr
	sne	mdec, <fptr
	seq.f	#0, #0 ; safer than `jmp 2'
fptr	jmp	dsl, #ffirst

; Skip to the end of the decrement steram

	add	#-12, fptr ;12 seems best step
	sne	mdec, @fptr
	jmp	-2

; Find our sibling

dm	add	#-1586, fptr ; optimal for -12 step
	seq	msib, <fptr
	jmp	-1

; Move him to our clear
	sub.b	fptr, fadj
	mov.ba	fadj, @fptr

	spl	2
	spl	1
	spl	1
	mov	<optr, {optr
	mov	<optr2, {optr2
optr	spl	oboot + 6, thepap + 6
optr2	jmp	oboot2 + 6, thepap + 6

sibpap	spl	2
	spl	1
	spl	1
	mov	<sptr, {sptr
sptr	spl	sboot + 6, thepap + 6

thepap
pNext	spl   4200,  {pThis
        mov  }pThis, }pNext
        mov   pDat,  >5200
pThis   mov pNext+6, }pNext
        jmz.f pNext, *pThis
pDat    dat  <2667,  <5334


end ds
