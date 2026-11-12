;redcode
;name Reamer E jodd
;author Steve Gunnell
;strategy Just a low process count paper
;assert 1


MARK	equ	6389
S1	equ	4076
R1	equ	4
S2	equ	2149
S3	equ	4571
IMP	equ	(3541)

pGO	spl	1,	<MARK
	mov	-1	,0
	spl	1	,}MARK	;6
L2:	spl	@0	,}S2
	mov.i	}-1	,>-1	;1
L3:	spl	@0	,(S2+IMP)
	mov.i	}L3	,>L3	;5
A1:	mov.i	#1	,{1	;8
A2:	mov.i	{-MARK	,{MARK	;0
T1:	add.ab	#MARK	,L3
	jmp	L3	,{L3	;16
B1:	dat	{2667	,{5334	;4

	end	pGO
