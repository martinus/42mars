;redcode
;name Switch To Zero Wins
;author Steve Gunnell
;oldname Hostile 2022GM stzw
;strategy quickbomb -> core-clear paper
;strategy from Sacha Zapf's 476
;assert 1

M	equ	380

start	mov.i	}M	,M*2
	mov.i	}M*3	,M*4
	mov.i	}M*5	,M*6
	mov.i	}M*7	,M*8
	mov.i	}M*9	,M*10
	mov.i	}M*11	,M*12
	mov.i	}M*13	,M*14
	mov.i	}M*15	,M*16
	mov.i	}M*17	,M*18

pGo	spl	2	, }M*19
	spl	1	, }M*20
	spl	1	, }M*21

	mov	{cp1	, {dest
dest	djn.f	374	, }M*22


STEP1	equ	668
STEP2	equ	305
CLR	equ	663

cp1	spl	@6	, >STEP1
	mov.i	}cp1	, >cp1
cp2	spl	@0	, }STEP2
	mov.i	}cp2	, >cp2
	mov.i	#1	, <1
	djn.b	-2	, #CLR

	end	start


