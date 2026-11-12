;redcode
;name Jack of Shadows
;author Steve Gunnell
;strategy Minor mods to Twilight Pits 3 by W. Mintardjo.
;assert 1

offs  EQU 196

start NOP 0, <-290   ;135x < b-field
s     MOV t, @t      ;JMP spot
      SUB trap, t
      JMP -2, <start
t     JMP -280, 281
trap  MOV 283, <-283
      JMP -1

      END start

