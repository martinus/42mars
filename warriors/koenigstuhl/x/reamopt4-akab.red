;redcode-94x
;name REAMer DX 141
;author Steve Gunnell
;strategy Dual variable configuration papers.
;strategy Baked in some anti-vamp and an imp spiral.
;assert CORESIZE==55440

        ORG        start

MARK   equ 42106
STEP1  equ 1944
STEP2  equ 12113
STEP3  equ 7363
HOP    equ 25240
R1     equ (2+1)
IMPNUM equ (43453) ; 6
GAP    equ 144

start  spl  start3,}MARK
       spl  start2,}MARK
       spl  1, <MARK ;
mov -1,0 ;
spl  1,}MARK ; 6 ; 7
       spl    STEP1 ,0
mov.i  >-1   ,}-1
mov.i  >-2 , }-2 ; 11
loop1:
       spl    @0    ,<STEP2
mov.i  }-1   ,>-1 ; 4
	   mov.i  bomb1, }MARK
       mov.i <-MARK,{MARK ; 3
       mov.i {loop1,<1
jmp   @0,STEP2-IMPNUM ; 2
bomb1:
       div.x <0, >0 ; 7

    for GAP
        dat.f   $0 , $0
    rof

start2:
       spl  1, <MARK ;
mov -1,0 ; 3 ; 1
loop2:
       spl    @0    ,}STEP2
mov.i  }-1   ,>-1 ; 1
	   mov.i  bomb2, }MARK
       mov.i bomb2,<1
djn.f  -2, <STEP3 ; 24
bomb2:
       dat  {IMPNUM, {IMPNUM+IMPNUM+1 ; 4
       dat.f $0        , $0
imp		mov.i	#9,		iStep
       for   (MAXLENGTH-CURLINE-9)
       dat.f $0        , $0
       rof

iStep	equ 47183
start3	spl		1,		}MARK
		spl		1,		}MARK
		spl		1,		}MARK
		spl  1, <MARK ;
spl  2,>1 ;
spl  1,}MARK; 6
		spl		2,		}MARK
		jmp		imp,	}MARK
		add.a	#iStep,	-1


        END
