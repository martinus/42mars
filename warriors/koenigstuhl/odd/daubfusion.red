;redcode-TinyLP
;name DaubFusion
;author Roy van Rijn
;strategy 4p spiral, 2x 1p paper, 2x 1p stone
;assert 1

      mov #7, #7
p1    mov <-1, <4
      mov 4,{1301
      jmn -2, @-3
      spl @-4, {5883
      jmz.b @0,6593
      dat >1, <1

for 8
dat 0,0
rof

      mov #7, #7
p2    mov <-1, <4
      mov 4,{1471
      jmn -2, @-3
      spl @-4, }3927
      jmz.b @0,5147
      dat >5034,<3594

for 2
dat 0,0
rof

sStep   equ     1098
s1      mov     {424,1-sStep
        sub.x   #sStep   ,-1
        jmp     -2       ,}-2

for 2
dat 0,0
rof

away2   equ     s2+1495

sStep2  equ     4637
s2      mov     stone2  , away2
        mov     stone2+1, away2+1
        mov     stone2+2, away2+2
        djn.f   away2   , {0

stone2  mov     {5247,1-sStep2
        sub.x   #sStep2  ,-1
        jmp     -2       ,}-2


for 2
dat 0,0
rof

start
      spl s1       , <1295
      spl p1       , }886
      spl s2       , >5658
      spl p2       , >4009

      spl 4        , }209
      spl 2        , >7945
      jmp imp      , {5320
      jmp imp+267  , {5285
      spl 2        , }5345
      jmp imp+534  , >3771
      jmp imp+801  , <7332

imp   mov.i #0     , 267

end   start
