;redcode
;name      Orochi-no-orochi
;author    Stephen Gunnell
;strategy  Derived from Hydra by Stephen Linhart.
;strategy  Orochi-no-orochi was an 8 headed dragon in Japanese myth.
;strategy  8 core clears are booted into core and left to run.
;assert 1
; KOFACOTO 2
 
a         spl     0,   <-2
b         mov    -3,   <-3
c         djn    -2,   <-4
 
start     spl  set4,  <600
          spl  set3, <1100
          spl  set2, <1600
set1      spl     5, <2100
          mov     c,    <3
          mov     b,    <2
          mov     a,    <1
          jmp    @0, #7500
          mov     c,    <3
          mov     b,    <2
          mov     a,    <1
          jmp    @0, #6500
set2      spl     5, <2600
          mov     c,    <3
          mov     b,    <2
          mov     a,    <1
          jmp    @0,  #-50
          mov     c,    <3
          mov     b,    <2
          mov     a,    <1
          jmp    @0, #5500
set3      spl     5, <3600
          mov     c,    <3
          mov     b,    <2
          mov     a,    <1
          jmp    @0, #4500
          mov     c,    <3
          mov     b,    <2
          mov     a,    <1
          jmp    @0, #3500
set4      spl     5, <4100
          mov     c,    <3
          mov     b,    <2
          mov     a,    <1
          jmp    @0, #2500
          mov     c,    <3
          mov     b,    <2
          mov     a,    <1
          jmp    @0, #1500

end       start 
