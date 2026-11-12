;redcode-94nop
;name HazyLazy A kosh
;author Steve Gunnell
;strategy boot -> SEQ scan with inline bomb and decoy
;strategy Went back to rejig Blur2 & The Machine
;strategy Revised the clear
;strategy Ob Kosh quote "YES"
;assert CORESIZE==8000


step	EQU	73510
gap	EQU	7
G1	EQU	3
G2	EQU	16
gate	EQU	(inc-10)
HOP	EQU	(clr-gate+10)
away	EQU	(clr+1793)

top:	mov.i	inc	,>scan-gap-2
scan:	seq.i	step-gap	,step
	mov.b	scan	,@top
a:	sub.f	inc	,scan
	jmn.b	top	,@top
inc:	spl.i	#0-step	,>0-step
	mov.i	clr	,>gate
btm:	djn.f	-1	,{gate
clr:	dat	1	,HOP
FOR	G1
	dat.f	$0	,$0
ROF
decoy	spl.i	#0-step	,>0-step
FOR	G2
	dat.f	$0	,$0
ROF
boot:	mov.i	clr	,<dest
FOR	8
	mov.i	{boot	,<dest
ROF
dest	spl	@dest	,away
	sub.f	dest	,dest
	dat	<dest	,<dest
FOR	8
	spl.a	#1	, 1
	spl.b	#1	, 1
	spl.ab	#1	, 1
	spl.ba	#1	, 1
	spl.i	#1	, 1
	spl.a	#1	, *1
	spl.b	#1	, *1
ROF
FOR	MAXLENGTH-CURLINE
	spl	#1	,#1
ROF

END	boot

