;redcode-94x
;name Foobar
;author bvowk
;strategy miss the deadline :)
;assert 1

       DAT.F  $   388, $  -388
       SPL.B  @     0, $    10
       SPL.B  @     0, $     9
       SPL.B  @     0, $     8
       SPL.B  @     0, $     7
       SPL.B  @     0, $     6
       SPL.B  @     0, $     5
       SPL.B  @     0, $     4
       SPL.B  @     0, $     3
       SPL.B  @     0, $     2
       SPL.B  @     0, $     1
START  SPL.B  @     0, $     0
       ADD.F  $   -12, $     2
       MOV.F  $     5, @     1
       MOV.X  {     0, <     0
       JMZ.B  $    -3, $     0
       DJN.B  $    -5, $    -1
       DAT.F  $     0, $     0
       DAT.F  <     4, <     0

end START
