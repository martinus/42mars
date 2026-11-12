;redcode
;name Hov 2X 26
;author Steve Gunnell
;strategy Bomb
;assert CORESIZE==55440

; stone constants
step    equ     43475                 ; primary step
hop     equ     452                 ; decr. ofs from bomb
time    equ     26375                 ; bombs before first mutation
BOOT    equ     39144
GAP1    equ     19
GAP2    equ     69
OFF1    equ     52209
STEP1   equ     51888
STEP2   equ     32197
BACK    equ     (0-1)

p1    mov #6, #0
      mov <-1, <3
      jmn -1, @-2
      spl @-3, <OFF1
      jmz.b @0, STEP1
      dat {1, <1

for GAP2
      dat 0,0
rof

        spl     #0      ,       #0
stone   mov     db      ,       @2
st      add     #step   ,       @-1
        djn.a   @-1    ,       *st-hop-(step*time) 
        jmp      BACK   ,       0

for GAP1
        dat.f   $0,  $0
rof

        dat.a   >hop    ,       >1      ; dat bomb for stone
db      dat.a   >hop    ,       >1      ; dat bomb for stone

start mov   db     , {ptrs
      mov   db-1   , {ptrs
      sub.a #GAP1  , ptrs
      mov   stone+3, {ptrs
      mov   stone+2, {ptrs
      mov   stone+1, {ptrs
      mov   stone+0, {ptrs
      mov   stone-1, {ptrs
      spl   p1     , {0
      spl   p2     , {0
ptrs  spl   BOOT   , 0
      spl   *ptrs  , 0
      spl   *ptrs  , 0
      jmp   *ptrs  , {ptrs

for GAP2
      dat 0,0
rof

p2    mov #6, #0
      mov <-1, <3
      jmn -1, @-2
      spl @-3, <OFF1
      jmz.b @0, STEP2
      dat {1, <1

end start

