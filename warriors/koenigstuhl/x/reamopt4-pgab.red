;redcode-94x
;name REAMer DX 92
;author Steve Gunnell
;strategy Dual variabe configuration papers.
;strategy Baked in some anti-vamp and an imp spiral.
;assert CORESIZE==55440

        ORG        start

MARK   equ 1662
STEP1  equ 34362
STEP2  equ 13676
STEP3  equ 33222
HOP    equ 15167
R1     equ (0+1)
IMPNUM equ (38567) ; 3
GAP    equ 115

start  spl  start3,}MARK
       spl  start2,}MARK
       spl  1, <MARK ;
spl  1,}MARK ;
spl  1,>MARK ; 8 ; 12
       spl    STEP1 ,0
mov.i  >-1   ,}-1
mov.i  >-2 , }-2 ; 11
loop1:
       spl    @0    ,}STEP2
mov.i  }-1   ,>-1 ; 1
	   mov.i  bomb1, }MARK
       mov.i <-MARK,{MARK ; 3
       mov.i {loop1,<1
djn.f   @0,<IMPNUM+1 ; 19
bomb1:
       dat  }IMPNUM, }IMPNUM+IMPNUM+1 ; 3

    for GAP
        dat.f   $0 , $0
    rof

start2:
       spl  0, }0 ; 3 ; 3
loop2:
       spl    @0    ,<STEP2
mov.i  }-1   ,>-1 ; 4
	   mov.i  bomb2, }MARK
       mov.i {loop2,<1
jmn.b   @0,STEP2-IMPNUM ; 17
bomb2:
       mod.x <0, >0 ; 6
       dat.f $0        , $0
imp		mov.i	#9,		iStep
       for   (MAXLENGTH-CURLINE-9)
       dat.f $0        , $0
       rof

iStep	equ 38567
start3	spl		1,		}MARK
		spl		1,		}MARK
		spl		1,		}MARK
		spl  1, <MARK ;
spl  1,}MARK ;
mov -1,0 ; 7
		spl		2,		}MARK
		jmp		imp,	}MARK
		add.a	#iStep,	-1


        END
