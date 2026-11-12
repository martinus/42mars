;redcode
;name Yet Some Always Fail
;author Steve Gunnell
;oldname Magenta 2022GM rnd4 ysaf
;strategy Evolved from markov chained opcodes and random fields
;assert 1

IMP	equ	381

L00		MOV.I	<IMP+1	,$681
L01		MOV.I	{164	,$478
L02		MOV.I	{530	,$243
L03		MOV.I	{339	,$481
L04		MOV.I	{305	,$35
L05		MOV.I	{709	,$643
L06		MOV.I	{199	,$696
L07		MOV.I	{606	,$659
L08		MOV.I	}360	,$529
L09		MOV.I	}IMP+1	,{519
L10		SPL.F	$2	,{359
L11		MOV.I	}560	,$499
L12		SPL.F	$1	,{386
L13		SPL.F	@0	,{66
L14		MOV.I	}-1	,>-1
L15		MOV.I	}L13	,>L13
L16		SPL.F	@0	,<539
L17		MOV.I	}-1	,>-1
L18		MOV.I	>25	,{373
L19		JMP.F	$L17	,}495

	end	L02

