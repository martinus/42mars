;redcode-94x
;name 1984
;author David Houston
;assert CORESIZE == 8000
;strategy Track down little brother.
;strategy "Convince" him to be a spl/spl/dat wiper.
;strategy Use a Recon style scanner to point little
;strategy brother at the bully.

ffirst	equ	-1000
fstep	equ	-108

sstep	equ	6557



; Scan for the decrement stream

dsl	add	#fstep, fptr
ds	sne	<fptr, <fptr
	add	#fstep, fptr
	sne	<fptr, <fptr
fadj	jmp	dsl, #(clear + fadj - fptr)

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

; And go to our scan
	jmp	sgo

; SSD clear that doubles as the spl/dat wiper for
; the recon-style scanner
wptr	dat	4, 2000
	dat	1, 20
scan	dat	2*sstep-1, 2*sstep-7
	spl	#1, 20
clear	spl	#3, 20
	mov	*wptr, >wptr
	mov	*wptr, >wptr
	jmp	-2

; Recon-style scanner. Uses the SSD clear as its
; wiper.
sinc	dat	sstep, sstep
sloop	add.f	sinc, scan
sgo	sne	*scan, @scan
	add.f	sinc, scan
	seq	*scan, @scan
	slt.a	#30, scan
	jmp	sloop
	mov.b	scan, wptr
	djn	sloop, #400 ; seems optimal
	jmp	clear


; This looks like the decrement stream
mdec	dat	-1, 0
; This looks like the last op in our little brother.
msib	jmp	-2, }-2

; Data
;fptr	dat	clear, ffirst

end ds
