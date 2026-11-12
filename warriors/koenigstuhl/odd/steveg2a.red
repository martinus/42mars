;redcode
;name Competent Rubbish Just Offered
;author Steve Gunnell
;oldname Magenta 2022GM rnd2 crjo
;strategy Evolved from markov chained opcodes and random fields
;assert 1

IMP	equ	37

L00		SPL.F	#IMP	,}159
L01		MOV.I	@-1	,}-1
L02		DJN.F	$L01	,}L00
L03		SPL.F	$L00	,<69
L04		MOV.I	#42	,$L05
L05		DAT.F	$0	,$0

	end	L03

