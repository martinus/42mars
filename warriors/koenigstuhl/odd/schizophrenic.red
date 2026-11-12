;redcode-t Random Rage
;author Joshua Hudson
;assert 1
;name The Schitzophrenic
;strategy oneshot or paper w/mirror

; The oneshot
o ADD.B  s, #250
  JMZ.F  -1, @-1
s SPL    #b - o, 41
  MOV.I  *p, >o
  DJN.F  -1, <-37
b DAT    #b - o, 41
for 20
  DAT    $0, $0
rof

; The switching machine
r LDP.B  #0, #0
l LDP.B  #41, #0
  MOD.AB #3, l  ; There are three states
  MUL.AB #3, l
  ADD.B  r, l
  ADD.BA l, 1
  STP.B  @3, 1
  JMP    *-1

; The initial state
  JMP    o, 1
; The state table
  JMP    o, 1
  JMP    o, 0
  JMP    o, 0

  JMP    p, 2
  JMP    o, 0
  JMP    o, 0

  JMP    o, 1
  JMP    p, 2
  JMP    p, 2

for 15
  DAT    $0, $0
rof

; The paper
p DIV.AB #2, i
  ADD.AB #2, i
  MOV.B  i, i + 1
  SPL    1, <-500
  SPL    1, <-600
  SPL    1, <-700
  MOV.I  <1, {1
  JMP    -200, i + 2
  SPL    442, 0
  MOV.I  >-1, }-1
  SPL    697, -2
  MOV.I  >-1, }-1
  MOV.I  <-100, <100
  SPL    @1, <231
i MOV.I  #-11, -2
  MOV.I  #-11, -2
end p

