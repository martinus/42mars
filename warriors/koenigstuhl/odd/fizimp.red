;redcode-88
;name fizImp
;author Christian Schmidt
;strategy Imp-Spreader
;assert 1

       DAT   #20
stone  ADD   #304,   -1
       MOV   imp,   @-2
       SPL   @-3
       JMP   stone
       DAT   #1
imp    mov   0,    1

       END     stone
