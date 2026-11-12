;redcode
;name Limited Edition
;author Lukasz Adamowski
; (with constants optimized by pre-release GAUSSE using Fizmo's benchmark for this round)
;assert 1

S1	EQU	596
S2	EQU	267

W1	EQU	528
W2	EQU	632
W3	EQU	566
W4	EQU	446

start	mov	clr,	clr+W1
	mov	clr+1,	clr+W1+1
	mov	bmb,	bmb+W2
	mov	bmb+1,	bmb+W2+1
	mov	bmb+2,	bmb+W2+2
	mov	clr,	clr+W3
	mov	clr+1,	clr+W3+1
	mov	bmb,	bmb+W4
	mov	bmb+1,	bmb+W4+1
	mov	bmb+2,	bmb+W4+2
	spl	8
	spl	4
	spl	2
	jmp	imp
	jmp	imp+S2
	spl	2
	jmp	imp+S2+S2
	jmp	clr+W1
	spl	4
	spl	2
	jmp	bmb+W2
	jmp	clr+W3
	spl	2
	jmp	bmb+W4
bmb	add	#S1,	1
	mov	2,	2
	jmp	-2
	dat	0,	0

clr	mov	-2,	<-2
	djn.f	-1,	<-3
		
imp	mov.i	#S2,	*0
	end	start
