;name Pieman
;author David Houston
;strategy Oneshot, dual dat clears, or paper
;assert 1
;       CORESIZE 2000
;       MAXPROCESSES 8000
;       MAXCYCLES 100000

;----------------------------------------------
; Oneshot

	for	MAXCYCLES * 2 >= CORESIZE * 7

org	scan

stream	equ	wptr - (tail - wptr) - 5

wptr	dat	clear, 1000
	spl	#2, tail - wptr

	for	MAXCYCLES * 2 < CORESIZE * 9
	dat	#2, tail - wptr
	rof
	for	MAXCYCLES * 2 >= CORESIZE * 9
	dat	#1, tail - wptr
	rof

clear	spl	#1, tail - wptr
	mov	*wptr, >wptr
	mov	*wptr, >wptr
	djn.f	-2, <stream

	for	7
	dat	0, 0
	rof

hop	equ	20
first	equ	-200

inc	dat	-40, -40
	add.f	inc, scan
scan	sne	first, first + hop
	jmp	-2
	mov.ab	scan, wptr
	jmp	clear

tail	i for 0
	rof

	rof

;----------------------------------------------
; Dual dat-clear

	for	(2 * MAXCYCLES < CORESIZE * 7) && (MAXCYCLES >= CORESIZE * 2)

	org	boot

bdist	equ	CORESIZE / 2

gate	equ	dclear - 4

dclear	spl	#0, 0
	mov	bomb, >gate
	djn.f	-1, {gate
bomb	dat	0, 8


	for	10
	dat	0, 0
	rof

boot	i for	4
	mov	<bptr, {bptr
	rof
	spl	dclear
bptr	jmp	dclear + 4 + bdist, dclear + 4

	rof

;----------------------------------------------
; Paper

	for	(MAXCYCLES < CORESIZE * 2) && (MAXPROCESSES >= 64)

	spl	1
	spl	1
	spl	1

	spl	@0, >1024
	mov	}-1, >-1
pap2	spl	@0, >-297
	mov	}-1, >-1
	mov	>-35, }497
	mov	{pap2, <1
	jmz.a	@0, 3144

	rof

;----------------------------------------------
; Tiny Paper

	for	(MAXCYCLES < CORESIZE * 2) && (MAXPROCESSES < 64)

	spl	1
	spl	1
	spl	@0, 256
	mov	}-1, >-1
	mov	{-2, <1
	jmz.a	@0, -417

	rof

end
