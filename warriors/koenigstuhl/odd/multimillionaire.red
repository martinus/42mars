;redcode
;name multimillionaire
;author philipp stefan
;strategy stone+gate
;assert 1
; KOFACOTO 2

step equ (82)
gate equ (wait-10)

wait      spl       0, <gate
          jmp       -1, <gate

for 73
          dat #0,#0
rof

start     spl       stone, <-1000
          spl       stone, <-2000
          spl       stone, <-3000
          spl       stone, <-4000
          spl       stone, <-5000
          spl       stone, <-6000
          spl       wait,  <-7000
stone     sub       #step, 1
          mov       2, 0
          jmp       -2, <gate

end       start
