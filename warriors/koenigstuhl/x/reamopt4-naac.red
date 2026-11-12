;redcode-94x
;name REAMer DX 52
;author Steve Gunnell
;strategy Dual variabe configuration papers.
;strategy Baked in some anti-vamp and an imp spiral.
;assert CORESIZE==55440

        ORG        start

MARK   equ 28409
STEP1  equ 46670
STEP2  equ 30268
STEP3  equ 20693
HOP    equ 24848
R1     equ (1+1)
IMPNUM equ (35873) ; 1
GAP    equ 146

start  spl  start3,}MARK
       spl  start2,}MARK
       spl  1, <MARK ;
spl  1,}MARK ;
mov -1,0 ; 7 ; 10
       spl    STEP1 ,0
mov.i  >-1   ,}-1
mov.i  >-2 , }-2 ; 11
loop1:
       spl    @0    ,>STEP2
mov.i  }-1   ,>-1 ; 3
	   mov.i  bomb1, }MARK
       mov.i bomb1,>MARK ; 7
       mov.i {loop1,<1
djn.f   @0,<IMPNUM+1 ; 19
bomb1:
       dat  }IMPNUM, }IMPNUM+IMPNUM+1 ; 3

    for GAP
        dat.f   $0 , $0
    rof

start2:
       spl  1, <MARK ;
spl  2,>1 ;
spl  1,}MARK; 6 ; 8
loop2:
       spl    @0    ,>STEP2
mov.i  }-1   ,>-1 ; 3
	   mov.i  bomb2, }MARK
       mov.i {loop2,<1
jmz.a   @0,STEP2-IMPNUM ; 14
bomb2:
       div.x <0, >0 ; 7
       dat.f $0        , $0
imp		mov.i	#9,		iStep
       for   (MAXLENGTH-CURLINE-9)
       dat.f $0        , $0
       rof

iStep	equ 43453
start3	spl		1,		}MARK
		spl		1,		}MARK
		spl		1,		}MARK
		spl  2, <MARK ;
spl  2,>1 ;
spl  1,}MARK; 5
		spl		2,		}MARK
		jmp		imp,	}MARK
		add.a	#iStep,	-1


        END
