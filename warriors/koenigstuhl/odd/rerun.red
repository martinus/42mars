;redcode
;name rerun
;author David Houston
;strategy silk
;strategy redcoders frenzy r-12
;assert 1

poff1	equ	390
poff2	equ	-350
poff3	equ	-260

pboff	equ	177

	spl	1
	spl	1
	spl	1

paper1	spl	@0, <poff1
	mov	}paper1, >paper1

paper2	spl	@0, {poff2
	mov	}paper2, >paper2

	mov	bomb, <pboff

	mov	{-paper2, <paper3
paper3	djn.f	@0, <poff3
bomb	mov	#1, <1
