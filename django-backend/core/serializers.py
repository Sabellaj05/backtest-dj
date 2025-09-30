from rest_framework import serializers

class BacktestSerializer(serializers.Serializer):
    ticker = serializers.CharField(max_length=20)
    startDate = serializers.DateField()
    endDate = serializers.DateField()
    strategy = serializers.CharField(max_length=100)
    capital = serializers.FloatField()

    def validate(self, attrs):
        """
        Check that the start date is before the end date.
        """
        if attrs['startDate'] >= attrs['endDate']:
            raise serializers.ValidationError("End date must be after start date.")
        return attrs
