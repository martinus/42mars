;redcode-94x
;name REAMer EX 14
;author Steve Gunnell
;strategy Dual variable configuration papers.
;strategy Baked in some anti-vamp and an imp spiral.
;strategy Added a pre-bomb.
;assert CORESIZE==55440

        ORG        stone

MARK   equ 13255
STEP1  equ 24430
STEP2  equ 17769
STEP3  equ 47445
HOP    equ 5250
R1     equ (2+1)
IMPNUM equ (35873) ; 1
GAP1   equ 15
GAP2   equ 5
GAP3   equ 27
DSTP   equ (3122*8)
TIME   equ 107

stone   SPL.B   #DSTP,   DSTP
loop    MOV.I   dbomb,  *dbomb
        MOV.I   dbomb,  @ dbomb
    	SUB.F   stone,   dbomb
        JMN.B   loop,    dbomb
		JMP     start,  <4000
dbomb   dat.f   #(DSTP*TIME)+8, #(DSTP*TIME)

    for GAP1
        dat.f   $0 , $0
    rof

start  spl  start3,}MARK
       spl  start2,}MARK
       spl  1, <MARK ;
	   spl  2,>1 ;
	   spl  1,}MARK; 6 ; 8
       spl    @0    ,>STEP1
	   mov.i  }-1   ,>-1
	   mov.i  }-2 , >-2 ; 9
loop1:
       spl    @0    ,<STEP2
	   mov.i  }-1   ,>-1
	   mov.i  }-2  ,>-2 ; 9
	   mov.i  bomb1, }MARK
       mov.i <-MARK,{MARK ; 3
       mov.i {loop1,<2
	   mov.i {loop1,<1
	   jmp   @0,STEP3 ; 3
bomb1:
       dat  >IMPNUM, >IMPNUM+IMPNUM+1 ; 1

    for GAP2
        dat.f   $0 , $0
    rof

start2:
       spl  1, <MARK ;
	   spl  1,}MARK ;
	   spl  1,>MARK ; 8 ; 12
loop2:
       spl    @0    ,>STEP2
	   mov.i  }-1   ,>-1 ; 3
	   mov.i  bomb2, }MARK
       mov.i {loop2,<1
	   jmz.a   @0,IMPNUM+1 ; 13
bomb2:
       dat  #1, #1 ; 0
       dat.f $0        , $0
imp	   mov.i	#9,		iStep

    for GAP3
       dat.f   $0 , $0
    rof

iStep	equ 38567
start3	spl		1,		}MARK
		spl		1,		}MARK
		spl		1,		}MARK
		spl  1, <MARK ;
	    mov -1,0 ;
	    spl  1,}MARK ; 6
		spl		2,		}MARK
		jmp		imp,	}MARK
		add.a	#iStep,	-1

        END
