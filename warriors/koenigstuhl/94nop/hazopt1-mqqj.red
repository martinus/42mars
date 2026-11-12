;redcode-94nop
;name HazyLazy B mqqj
;author Steve Gunnell
;strategy Short run scanner with decoy.
;strategy Based on The Machine.
;assert CORESIZE==8000


step	EQU	4685
away	EQU	(clr+6485)
G1	EQU	11
G2	EQU	18
G3	EQU	3
STT	EQU	(0-(step*1098))
gate	EQU	(inc-2)
HOP	EQU	(clr-gate+2)
GAP	EQU	8
TIME	EQU	1098

; Variant 2 - Blur2 like
ptr:	mov.i	inc+1	, >step
top:	mov.i	bomb	, >ptr
scan:	seq.i	STT	, STT+GAP
	mov.ab	scan	, @top
	sub.f	inc	, scan
	djn.b	top	, #TIME
; 3 line d-clear counter decrement
inc:	spl.i	#-step	, >-step
	mov.i	clr	, >gate
btm:	djn.f	-1	, {gate
clr:	dat.i	#1 	,HOP
    for G1
	dat.f	$0	, $0
    rof
bomb: spl #0, #0
    for G2
	dat.f	$0	, $0
    rof
boot:	mov.i	clr	, <dest
    FOR btm-ptr
	mov.i	{boot	, <dest
    ROF
dest:	mov.i	bomb	, *away
	spl	@dest	, {-1000
	mov.i	{boot	, <dest
	sub.f	dest	, dest
	dat.f	$0	, $0
    for G3
	dat.f	$0	, $0
    rof
    FOR 4
	spl.a	#1	, 1
	spl.b	#1	, 1
	spl.ab	#1	, 1
	spl.ba	#1	, 1
	spl.i	#1	, 1
	spl.a	#1	, *1
	spl.b	#1	, *1
	spl.ab	#1	, *1
    ROF
    FOR MAXLENGTH-CURLINE
	spl	#1	, #1
    ROF

END boot

