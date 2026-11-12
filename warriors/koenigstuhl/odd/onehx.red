;redcode-lp
;name 1hx
;author Michal Janeczek
;assert 1
;       MAXPROCESSES == 8
;       CORESIZE == 55440
;strategy scanner

p add.ba #s , #16211+1
  jmz.f  @i , {p
  slt.ab @i , #5
i mov    *s , *p
  jmp    @i , p
  jmp    #1 , {1
s dat    -1 , 0

  end    p

