;redcode
;author Brian Zellner
;name Smoke v1.2
;assert (CORESIZE==8000)
;strategy  Qscan -> stone & impring -> coreclear -> impgate
;strategy  v1.1  Longer SPL carpet if the Qscan finds something
;strategy  v1.2  Free a line elsewhere to help Qscan vs. stones
;strategy  v1.3  Fixed poor carpet constants from v1.1

incr      EQU    3044                  ; Increment number for the stone
dist      EQU    incr*1000             ; Offset for the stone MOV
initial   EQU    13                    ; How far off to start the stone
xsrc      EQU    dist-stone            ; Where to place the exodus instruction
space     EQU    129                   ; Interval for the quick-scan
offset    EQU    6                     ; How far from the scan is the MOV
impptr    EQU    -164                  ; Where to put the vulnerable imp
soffset   EQU    -400                  ; Where to put the stone
coffset   EQU    -190                  ; Where to put the cclear
stoneptr  EQU    stoneinc+1            ; First DAT instruction
exodusloc EQU    stoneptr+3570-3       ; Where to put the exodus

splcpt    SPL    -1,            1                  ; The split-carpet
start     CMP    space*1+last,  space*31+last      ; Do a scan
          MOV    #space*1+last-found-offset, found ; Save if found
          CMP    space*2+last,  space*32+last      ; Do a scan
          MOV    #space*2+last-found-offset, found ; Save if found
          CMP    space*3+last,  space*33+last      ; Do a scan
          MOV    #space*3+last-found-offset, found ; Save if found
          CMP    space*4+last,  space*34+last      ; Do a scan
          MOV    #space*4+last-found-offset, found ; Save if found
          CMP    space*5+last,  space*35+last      ; Do a scan
          MOV    #space*5+last-found-offset, found ; Save if found
          CMP    space*6+last,  space*36+last      ; Do a scan
          MOV    #space*6+last-found-offset, found ; Save if found
          CMP    space*7+last,  space*37+last      ; Do a scan
          MOV    #space*7+last-found-offset, found ; Save if found
          CMP    space*8+last,  space*38+last      ; Do a scan
          MOV    #space*8+last-found-offset, found ; Save if found
          CMP    space*9+last,  space*39+last      ; Do a scan
          MOV    #space*9+last-found-offset, found ; Save if found
          CMP    space*10+last, space*40+last      ; Do a scan
          MOV    #space*10+last-found-offset,found ; Save if found
          CMP    space*11+last, space*41+last      ; Do a scan
          MOV    #space*11+last-found-offset,found ; Save if found
          CMP    space*12+last, space*42+last      ; Do a scan
          MOV    #space*12+last-found-offset,found ; Save if found
          CMP    space*13+last, space*43+last      ; Do a scan
          MOV    #space*13+last-found-offset,found ; Save if found
          CMP    space*14+last, space*44+last      ; Do a scan
          MOV    #space*14+last-found-offset,found ; Save if found
          CMP    space*15+last, space*45+last      ; Do a scan
          MOV    #space*15+last-found-offset,found ; Save if found
          CMP    space*16+last, space*46+last      ; Do a scan
          MOV    #space*16+last-found-offset,found ; Save if found
          CMP    space*17+last, space*47+last      ; Do a scan
          MOV    #space*17+last-found-offset,found ; Save if found
          CMP    space*18+last, space*48+last      ; Do a scan

          MOV    #space*18+last-found-offset,found ; Save if found
          CMP    space*19+last, space*49+last      ; Do a scan
          MOV    #space*19+last-found-offset,found ; Save if found
          CMP    space*20+last, space*50+last      ; Do a scan
          MOV    #space*20+last-found-offset,found ; Save if found

          JMN    found,         found              ; Got it

          CMP    space*21+last, space*51+last      ; Do a scan
          MOV    #space*21+last-found-offset,found ; Save if found
          CMP    space*22+last, space*52+last      ; Do a scan
          MOV    #space*22+last-found-offset,found ; Save if found
          CMP    space*23+last, space*53+last      ; Do a scan
          MOV    #space*23+last-found-offset,found ; Save if found
          CMP    space*24+last, space*54+last      ; Do a scan
          MOV    #space*24+last-found-offset,found ; Save if found
          CMP    space*25+last, space*55+last      ; Do a scan
          MOV    #space*25+last-found-offset,found ; Save if found
          CMP    space*26+last, space*56+last      ; Do a scan
          MOV    #space*26+last-found-offset,found ; Save if found
          CMP    space*27+last, space*57+last      ; Do a scan
          MOV    #space*27+last-found-offset,found ; Save if found
          CMP    space*28+last, space*58+last      ; Do a scan
top       MOV    #space*28+last-found-offset,found ; Save if found
          CMP    space*29+last, space*59+last      ; Do a scan
          MOV    #space*29+last-found-offset,found ; Save if found
          CMP    space*30+last, space*60+last      ; Do a scan
          MOV    #space*30+last-found-offset,found ; Save if found

          JMZ    bootup,   found       ; Did we see something?
found     CMP    start-2,  0           ; Is the first number it?
          SUB    #30*space,found       ; If so, brace for adjustment
          ADD    #30*space+12,found    ; If not, must be the second #
qckbom    MOV    splcpt,   <found      ; Lay a SPL carpet
          DJN    qckbom,   #20         ; Make it longer at the end

bootup    MOV    imp,      impptr      ; Move the imp starting position out
          SPL    bootstn,  0           ; Start the stone

;---------------------------- Imp startup -------------------------------------

startimp  SPL    ring,     0           ; Processes 7-8-9
sdestptr  SPL    ring,     #soffset    ; Processes 4-5-6
cdestptr  JMP    ring,     #coffset-1  ; Processes 1-2-3

ring      SPL    imp2,     0           ; Prepare the other 2
          DJN    1,        <4000       ; Wait for them to split
          JMP    impptr+bootup,0       ; Then lead the way

imp2      SPL    imp3,     0           ; Split into the back 2/3rds
          JMP    impptr+bootup+2667,0    ; Second process
imp3      JMP    impptr+bootup+2667+2667,0 ; Third process

imp       MOV    0,        2667        ; The imp

;----------------------------- Stone startup ----------------------------------

bootstn   MOV    <stoneptr,<sdestptr   ; Move the stone where it belongs
          DJN    -1,       #5          ; Until the entire stone is inplace
          SPL    @sdestptr,0           ; Then start the stone
          MOV    <stoneptr,<cdestptr   ; Begin moving the cclear
          DJN    -1,       #5          ; Until it is all there
          SPL    @cdestptr,#13         ; Then start it
          DJN    0,        -1          ; Wait for the stone
          MOV    exodus,   exodusloc   ; Then put exodus in place
          JMP    -212,     0           ; Speed up the cclear
exodus    JMP    210,      #1          ; The line to abort stone

cclear    SPL    0,        <-3         ; Top of the core-clear
          MOV    3,        <-5         ; Clear the core (ho-hum)
          JMP    -1,       <-5         ; Until we loop
          DAT    <-6,      <-7         ; Placeholded (stone-hit)
          DAT    <-4,      <-3         ; Imp-gate dat line

stone     MOV    <initial+dist, initial; Attack/decrement line
stonetop  SPL    -1,       <top-9      ; Splitter into stone/partial imp gate
          ADD    stoneinc, stone       ; Increment attacker
          DJN    -2,       <top-9+1    ; DJN stream/restart stone pass
last
stoneinc  DAT    #incr,    #incr       ; Added to stone



          END    start

