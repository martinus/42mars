;redcode-odd
;name MadAdam
;author Franklyn B. Fish
;strategy Using LethalFrog hopper [Fizmo] as basis. 
;strategy 2 Copies as can't predict coresize.
;assert 1
;       MAXLENGTH == 20
;       CORESIZE       8000   - The more spacer the harder for scanners
;       MAXPROCESSES   21     - I want 6 [I think there are 6 players? Maybe 4]
;       MAXCYCLES      100000

pStep  EQU   4499
pBomb  EQU   1536

front  dat   #0,       #pStep
       mov.i }-1,      >-1
       jmp   pStep-1,  <pBomb

for 5
       dat   0,        0
rof

start  spl   idle,     >CORESIZE/3
       spl   2,        >CORESIZE/3
       spl   1,        >CORESIZE/3
       jmp   front+1,  >CORESIZE/3

for 5 -1
       dat   0,        0
rof

idle:  djn.b    #0,     #6
       mov.ab   #4451,  front           ;Randomish prime
       jmp      start+1,>CORESIZE/3

end start   ;[PBT]
