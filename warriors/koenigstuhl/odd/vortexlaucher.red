;redcode
;name Vortex Launcher
;author inversed
;assert 1
;strategy Cool, as small as standard launcher. I think it will be widely used.
;strategy Here is my solution for vortex launcher:

istep	equ	2667
gap	equ	10

istart	spl	1,	0
	spl	1,	0

inc	spl	#istep,	istep
loop	add	inc,	ptr
	spl	2,	0
ptr	jmp	imp1-istep-3,	imp2-istep-3
	jmp	@ptr
	for	gap
	dat	0,	0
	rof
imp2	mov.i	#1,	istep
	for	50
	dat	0,	0
	rof
imp1	mov.i	#istep,	*0

